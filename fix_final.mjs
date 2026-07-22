import fs from 'fs';
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

// 1. Rename subscribeConfig -> subscribeBranding (Wait, we need both!)
const configMethods = `
  subscribeBranding: (callback: (config: any) => void) => {
    return subscribeTable(
      'branding_config',
      (configs) => {
        if (configs.length > 0) {
          callback(configs[0]);
        }
      },
      (row) => row
    );
  },

  subscribeConfig: (callback: (config: any) => void, dealerId?: string) => {
    return subscribeTable(
      'app_config',
      (configs) => {
        if (configs.length > 0) callback(configs[0]);
        else callback(null);
      },
      (row) => row,
      dealerId
    );
  },

  updateConfig: async (config: any, authorName: string, dealerId: string) => {
    try {
      const configType = dealerId === 'main' ? 'main' : \`tenant_\${dealerId}\`;
      const dbRow = { ...config, config_type: configType, dealer_id: dealerId };
      await upsertPB('app_config', 'config_type', configType, dbRow);
    } catch (e) {
      console.error('updateConfig error:', e);
    }
  },
`;

code = code.replace(/subscribeConfig: \([\s\S]*?console.error\('updateConfig error:', e\);\s*\}\s*\},/m, configMethods);

// 2. Fix sendMessage and sendVoiceMessage
const chatMethods = `
  sendMessage: async (currentUser: any, text: string, replyData: any, recipientId?: string, isGroupChat?: boolean) => {
    try {
      await pb.collection('chat_messages').create({
        sender_id: currentUser.uid,
        sender_name: currentUser.fullName || currentUser.username,
        receiver_id: isGroupChat ? '' : (recipientId || 'global'),
        group_id: isGroupChat ? (recipientId || '') : '',
        content: text,
        type: 'text',
        seen_by: JSON.stringify([currentUser.uid]),
        reply_to: replyData ? JSON.stringify(replyData) : ''
      });
    } catch (error) {
      console.error('PB: sendMessage error:', error);
    }
  },

  sendVoiceMessage: async (currentUser: any, base64: string, duration: number, replyData: any, recipientId?: string, isGroupChat?: boolean) => {
    try {
      // Decode base64 to blob if needed, but here we can just save it as text/base64 in a long text field, 
      // or assuming we can just push it directly depending on schema. 
      // We will just store it in audio_url as base64 string for this fix, 
      // since the signature takes base64.
      await pb.collection('chat_messages').create({
        sender_id: currentUser.uid,
        sender_name: currentUser.fullName || currentUser.username,
        receiver_id: isGroupChat ? '' : (recipientId || 'global'),
        group_id: isGroupChat ? (recipientId || '') : '',
        content: \`Voice message (\${duration}s)\`,
        type: 'voice',
        audio_url: base64,
        seen_by: JSON.stringify([currentUser.uid]),
        reply_to: replyData ? JSON.stringify(replyData) : ''
      });
    } catch (error) {
      console.error('PB: sendVoiceMessage error:', error);
    }
  },
`;

code = code.replace(/sendMessage: async \([\s\S]*?console.error\('PB: sendVoiceMessage error:', error\);\s*\}\s*\},/m, chatMethods);

// 3. Remove duplicate updateClientComplaints if any, and make sure we have the 2-argument one
// First delete all updateClientComplaints
code = code.replace(/updateClientComplaints: async \([\s\S]*?console.error\('PB: updateClientComplaints error:', e\);\s*\}\s*\},/g, '');

const updateClientComplaintsMethod = `
  updateClientComplaints: async (clientName: string, updatedData: any) => {
    try {
      const records = await pb.collection('complaints').getFullList({
        filter: \`customerName = "\${clientName}"\`
      });
      
      for (const record of records) {
        await pb.collection('complaints').update(record.id, {
          number: updatedData.number || record.number,
          address: updatedData.address || record.address,
          area: updatedData.area || record.area
        }).catch(() => {});
      }
    } catch (e) {
      console.error('PB: updateClientComplaints error:', e);
    }
  },
`;

code = code.replace(/updateBranding: async/m, updateClientComplaintsMethod + '\n  updateBranding: async');

// 4. Fix TS error in subscribeRecycleBin where transform was omitted
code = code.replace(
  /subscribeRecycleBin: \(callback: \(items: any\[\]\) => void, dealerId\?: string\) => \{\s*return subscribeTable\(\s*'recycle_bin',\s*\(items\) => \{[\s\S]*?callback\(filtered\);\s*\},\s*\(row\) => row,\s*dealerId,\s*'deleted_at'\s*\);\s*\}/m,
  `subscribeRecycleBin: (callback: (items: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'recycle_bin',
      (items) => {
        let filtered = items;
        if (dealerId && dealerId !== 'main') {
          filtered = filtered.filter((n: any) => n.dealer_id === dealerId || n.dealerId === dealerId);
        }
        filtered.sort((a, b) => b.deleted_at - a.deleted_at);
        callback(filtered);
      },
      (row) => row,
      dealerId,
      'deleted_at'
    );
  }`
);

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
