import fs from 'fs';
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

const moreMethods = `
  subscribeConfig: (callback: (config: any) => void) => {
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

  updateConfig: async (config: any) => {
    try {
      await upsertPB('branding_config', 'config_type', 'main', config);
    } catch (e) {
      console.error('updateConfig error:', e);
    }
  },

  subscribeGroups: (callback: (groups: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'chat_groups',
      callback,
      (row) => ({
        id: row.id,
        name: row.name,
        createdBy: row.created_by,
        dealerId: row.dealer_id,
        members: row.members ? JSON.parse(row.members) : []
      }),
      dealerId
    );
  },

  subscribeComplaints: (callback: (complaints: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'complaints',
      callback,
      (row) => fromDb('complaints', row),
      dealerId
    );
  },

  getClients: async (dealerId?: string) => {
    try {
      const filter = dealerId && dealerId !== 'main' ? \`dealer_id = "\${dealerId}"\` : '';
      const records = await pb.collection('clients').getFullList({ filter });
      return records;
    } catch (error) {
      return [];
    }
  },

  subscribeMessages: (callback: (msgs: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'chat_messages',
      callback,
      (row) => ({
        id: row.id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        receiverId: row.receiver_id,
        groupId: row.group_id,
        content: row.content,
        timestamp: row.created,
        seenBy: row.seen_by ? JSON.parse(row.seen_by) : [],
        type: row.type || 'text',
        audioUrl: row.audio_url || undefined
      }),
      dealerId
    );
  },

  saveComplaint: async (complaint: any, authorName: string) => {
    try {
      const dbRow = toDb('complaints', complaint);
      const record = await pb.collection('complaints').create(dbRow);
      return { id: record.id, ...complaint };
    } catch (error) {
      console.error('PB: saveComplaint error:', error);
      throw error;
    }
  },

  sendMessage: async (msg: any) => {
    try {
      await pb.collection('chat_messages').create({
        sender_id: msg.senderId,
        sender_name: msg.senderName,
        receiver_id: msg.receiverId,
        group_id: msg.groupId,
        content: msg.content,
        type: 'text',
        seen_by: JSON.stringify(msg.seenBy || [])
      });
    } catch (error) {
      console.error('PB: sendMessage error:', error);
    }
  },

  sendVoiceMessage: async (senderId: string, receiverId: string, groupId: string, audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('sender_id', senderId);
      if (receiverId) formData.append('receiver_id', receiverId);
      if (groupId) formData.append('group_id', groupId);
      formData.append('type', 'voice');
      formData.append('audio_file', audioBlob, 'voice.webm');
      
      await pb.collection('chat_messages').create(formData);
    } catch (error) {
      console.error('PB: sendVoiceMessage error:', error);
    }
  },

  deleteMessage: async (msgId: string) => {
    try {
      await pb.collection('chat_messages').delete(msgId);
    } catch (error) {
      console.error('PB: deleteMessage error:', error);
    }
  },

`;

code = code.replace(
  /subscribeClients:/m,
  moreMethods + '\n  subscribeClients:'
);

code = code.replace(
  /updateComplaint: async \(id: string, data: any, authorName: string\) => \{/,
  'updateComplaint: async (id: string, data: any, customerName: string, authorName: string) => {'
);
code = code.replace(
  /updateClientComplaints: async \(clientId: string, clientName: string, newNumber: string\) => \{[\s\S]*?console.error\('PB: updateClientComplaints error:', e\);\s*\}\s*\},\s*subscribeClients:/m,
  'subscribeClients:'
);

// Fix the typescript error in subscribeClients
code = code.replace(
  /subscribeClients: \(callback: \(clients: any\[\]\) => void, dealerId\?: string\) => \{\s*return subscribeTable\(\s*'clients',\s*\(clients\) => \{[\s\S]*?callback\(filtered\);\s*\},\s*dealerId\s*\);\s*\}/m,
  `subscribeClients: (callback: (clients: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'clients',
      (clients) => {
        let filtered = clients;
        if (dealerId && dealerId !== 'main') {
          filtered = filtered.filter((n: any) => n.dealer_id === dealerId || n.dealerId === dealerId);
        }
        callback(filtered);
      },
      (row) => row,
      dealerId
    );
  }`
);

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
