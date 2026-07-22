const fs = require('fs');
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

const missingMethods = `
  subscribeClients: (callback: (clients: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'clients',
      (clients) => {
        let filtered = clients;
        if (dealerId && dealerId !== 'main') {
          filtered = filtered.filter((n: any) => n.dealer_id === dealerId || n.dealerId === dealerId);
        }
        callback(filtered);
      },
      dealerId
    );
  },

  createClient: async (data: any, authorName: string, dealerId: string = 'main') => {
    try {
      const dbRow = toDb('clients', data);
      dbRow.dealer_id = dealerId;
      const record = await pb.collection('clients').create(dbRow);
      
      await pocketbaseService.createNotification({
        type: 'client_added',
        message: \`Client directory established for "\${data.name}"\`,
        authorName
      });
      return { id: record.id, ...data };
    } catch (error) {
      console.error('PB: createClient error:', error);
      throw error;
    }
  },

  updateClient: async (id: string, updatedData: any, clientName: string, authorName: string) => {
    try {
      const dbRow = toDb('clients', updatedData);
      await upsertPB('clients', 'client_id', id, dbRow);
      
      await pocketbaseService.createNotification({
        type: 'client_updated',
        message: \`Client directory updated for "\${clientName}"\`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateClient error:', error);
      throw error;
    }
  },

  updateClientComplaints: async (clientName: string, updatedData: any) => {
    try {
      const records = await pb.collection('complaints').getFullList({
        filter: \`customerName = "\${clientName}"\`
      });
      
      for (const record of records) {
        await pb.collection('complaints').update(record.id, {
          number: updatedData.number,
          address: updatedData.address,
          area: updatedData.area
        }).catch(() => {});
      }
    } catch (e) {
      console.error('PB: updateClientComplaints error:', e);
    }
  },

  updateBranding: async (branding: any, authorName: string) => {
    try {
      const dbRow = {
        config_type: 'branding',
        dashboard_title: branding.dashboardTitle,
        dashboard_subtext: branding.dashboardSubtext,
        theme_color: branding.themeColor,
        logo_url: branding.logoUrl,
        icon_type: branding.iconType,
        custom_icon_url: branding.customIconUrl,
        sidebar_color: branding.sidebarColor,
        background_style: branding.backgroundStyle,
        card_style: branding.cardStyle,
        font_family: branding.fontFamily,
        chart_style: branding.chartStyle,
        button_style: branding.buttonStyle,
        primary_color_hsl: branding.primaryColorHsl,
        accent_color_hsl: branding.accentColorHsl,
        dark_mode_preference: branding.darkModePreference
      };
      await upsertPB('branding_config', 'config_type', 'branding', dbRow);
      
      await pocketbaseService.createNotification({
        type: 'config_updated',
        message: 'System branding architecture reconfigured',
        authorName
      });
    } catch (error) {
      console.error('PB: updateBranding error:', error);
      throw error;
    }
  },

  createMonitorTarget: async (domain: string, user: any, label: string, lat?: number, lng?: number) => {
    try {
      const dealerId = user.role !== 'super_admin' ? user.dealerId : 'main';
      const record = await pb.collection('monitor_targets').create({
        domain,
        created_by: user.fullName || user.username,
        dealer_id: dealerId || 'main',
        label,
        lat: lat || 0,
        lng: lng || 0
      });
      return {
        id: record.id,
        domain: record.domain,
        createdBy: record.created_by,
        dealerId: record.dealer_id,
        label: record.label,
        lat: record.lat,
        lng: record.lng
      };
    } catch (error) {
      console.error('PB: createMonitorTarget error:', error);
      throw error;
    }
  },

  createGroup: async (name: string, members: string[], currentUser: any) => {
    try {
      const dealerId = currentUser.role !== 'super_admin' ? currentUser.dealerId : 'main';
      const record = await pb.collection('chat_groups').create({
        name,
        created_by: currentUser.uid,
        dealer_id: dealerId || 'main',
        members: JSON.stringify(members)
      });
      return {
        id: record.id,
        name: record.name,
        createdBy: record.created_by,
        dealerId: record.dealer_id,
        members: JSON.parse(record.members)
      };
    } catch (error) {
      console.error('PB: createGroup error:', error);
      throw error;
    }
  },

  deleteGroup: async (groupId: string) => {
    try {
      await pb.collection('chat_groups').delete(groupId);
    } catch (error) {
      console.error('PB: deleteGroup error:', error);
      throw error;
    }
  },

  clearMessagesByScope: async (userId: string, scopeId: string, isGroup: boolean) => {
    try {
      const filter = isGroup 
        ? \`group_id = "\${scopeId}"\`
        : \`(sender_id = "\${userId}" && receiver_id = "\${scopeId}") || (sender_id = "\${scopeId}" && receiver_id = "\${userId}")\`;
      
      const records = await pb.collection('chat_messages').getFullList({ filter });
      for (const record of records) {
        await pb.collection('chat_messages').delete(record.id).catch(() => {});
      }
    } catch (error) {
      console.error('PB: clearMessagesByScope error:', error);
    }
  },

  markAsSeen: async (messageId: string, userId: string, userName: string) => {
    try {
      const record = await pb.collection('chat_messages').getOne(messageId);
      const seenBy = record.seen_by ? JSON.parse(record.seen_by) : [];
      if (!seenBy.includes(userId)) {
        seenBy.push(userId);
        await pb.collection('chat_messages').update(messageId, {
          seen_by: JSON.stringify(seenBy)
        });
      }
    } catch (error) {
      console.error('PB: markAsSeen error:', error);
    }
  },
`;

code = code.replace(
  /deleteClient: async/m,
  missingMethods + '\n  deleteClient: async'
);

// We should also remove addMonitorTarget
code = code.replace(/addMonitorTarget: async \([\s\S]*?\},/m, '');

// updateClientComplaints was duplicated earlier in our fix_delete script, let's remove the extra one if any
// But actually we need it. Let's make sure it's not defined twice.

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
