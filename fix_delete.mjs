import fs from 'fs';
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

// We will implement replace for deleteComplaint, deleteClient, deleteLedgerSheet

code = code.replace(
  /deleteComplaint: async \(id: string, customerName: string, authorName: string\) => {[\s\S]*?deleteClient: async/m,
  `deleteComplaint: async (id: string, customerName: string, authorName: string, dealerId: string = 'main') => {
    try {
      let recordId = '';
      let recordData = null;
      try {
        const record = await pb.collection('complaints').getOne(id);
        recordId = record.id;
        recordData = record;
      } catch (e) {
        try {
          const record = await pb.collection('complaints').getFirstListItem(\`complaint_id = "\${id}"\`);
          recordId = record.id;
          recordData = record;
        } catch (e2) {
          try {
            const record = await pb.collection('complaints').getFirstListItem(\`id = "\${id}"\`);
            recordId = record.id;
            recordData = record;
          } catch (e3) {}
        }
      }

      if (recordId) {
        if (recordData) {
          try {
            await pocketbaseService.saveToRecycleBin('complaints', id, authorName, dealerId, recordData);
          } catch (err) {}
        }
        await pb.collection('complaints').delete(recordId);
      } else {
        throw new Error(\`Complaint record not found for ID: \${id}\`);
      }

      await pocketbaseService.createNotification({
        type: 'complaint_deleted',
        message: \`Registry removed: "\${customerName}" protocol terminated\`,
        authorName
      });
    } catch (error) {
      console.error('PB: deleteComplaint error:', error);
      throw error;
    }
  },

  updateComplaintStatus: async (id: string, status: ComplaintStatus, customerName: string, authorName: string, authorId: string, remarks?: string, reviews?: ComplaintReview[]) => {
    try {
      const updateData: any = { 
        status, 
        updatedAt: Date.now(),
        ...(remarks && { remarks, remarkAuthorId: authorId, remarkAuthorName: authorName }),
        ...(reviews !== undefined && { reviews })
      };
      const dbRow = toDb('complaints', updateData);
      await upsertPB('complaints', 'complaint_id', id, dbRow);
      
      await pocketbaseService.createNotification({
        type: 'complaint_updated',
        message: \`Status updated to \${status.toUpperCase()} for "\${customerName}"\${remarks ? \` - Remarks: \${remarks}\` : ''}\${reviews && reviews.length > 0 ? \` - Reviews count: \${reviews.length}\` : ''}\`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateComplaintStatus error:', error);
      throw error;
    }
  },

  updateComplaint: async (id: string, data: any, authorName: string) => {
    try {
      const dbRow = toDb('complaints', { ...data, updatedAt: Date.now() });
      await upsertPB('complaints', 'complaint_id', id, dbRow);
      
      await pocketbaseService.createNotification({
        type: 'complaint_updated',
        message: \`Complaint details updated for "\${data.customerName}"\`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateComplaint error:', error);
      throw error;
    }
  },

  updateComplaintRemarks: async (id: string, customerName: string, remarks: string, authorName: string, authorId: string) => {
    try {
      const updateData = { 
        remarks, 
        remarkAuthorId: authorId,
        remarkAuthorName: authorName,
        updatedAt: Date.now() 
      };
      const dbRow = toDb('complaints', updateData);
      await upsertPB('complaints', 'complaint_id', id, dbRow);
      
      await pocketbaseService.createNotification({
        type: 'complaint_updated',
        message: \`Remarks updated for "\${customerName}": \${remarks}\`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateComplaintRemarks error:', error);
      throw error;
    }
  },

  syncOfflineComplaints: async (complaints: any[], authorName: string) => {
    try {
      if (!pb.authStore.isValid) return;
      
      for (const complaint of complaints) {
        const { id, ...data } = complaint;
        if (!id || String(id).startsWith('temp_')) {
          const dbRow = toDb('complaints', data);
          await pb.collection('complaints').create(dbRow);
        } else {
          const dbRow = toDb('complaints', data);
          await upsertPB('complaints', 'complaint_id', id, dbRow);
        }
      }
      
      await pocketbaseService.createNotification({
        type: 'complaint_created',
        message: \`Synced \${complaints.length} offline registries\`,
        authorName
      });
    } catch (error) {
      console.error('PB: syncOfflineComplaints error:', error);
    }
  },

  updateClientComplaints: async (clientId: string, clientName: string, newNumber: string) => {
    try {
      const records = await pb.collection('complaints').getFullList({
        filter: \`customerName = "\${clientName}"\`
      });
      
      for (const record of records) {
        await pb.collection('complaints').update(record.id, {
          number: newNumber
        }).catch(() => {});
      }
    } catch (e) {
      console.error('PB: updateClientComplaints error:', e);
    }
  },

  deleteClient: async`
);

code = code.replace(
  /deleteClient: async \(id: string, clientName: string, authorName: string\) => {[\s\S]*?deleteMonitorTarget: async/m,
  `deleteClient: async (id: string, clientName: string, authorName: string, dealerId: string = 'main') => {
    try {
      let recordId = '';
      let recordData = null;
      try {
        const record = await pb.collection('clients').getOne(id);
        recordId = record.id;
        recordData = record;
      } catch (e) {
        try {
          const record = await pb.collection('clients').getFirstListItem(\`client_id = "\${id}"\`);
          recordId = record.id;
          recordData = record;
        } catch (e2) {
          try {
            const record = await pb.collection('clients').getFirstListItem(\`id = "\${id}"\`);
            recordId = record.id;
            recordData = record;
          } catch (e3) {}
        }
      }

      if (recordId) {
        if (recordData) {
          try {
            await pocketbaseService.saveToRecycleBin('clients', id, authorName, dealerId, recordData);
          } catch (err) {}
        }
        await pb.collection('clients').delete(recordId);
      } else {
        throw new Error(\`Client record not found for ID: \${id}\`);
      }

      await pocketbaseService.createNotification({
        type: 'client_deleted',
        message: \`Client deleted: "\${clientName}"\`,
        authorName
      });
    } catch (error) {
      console.error('PB: deleteClient error:', error);
      throw error;
    }
  },

  // --- Network Monitor DB endpoints ---
  
  getMonitorTargets: async (dealerId?: string): Promise<MonitorTarget[]> => {
    try {
      const filter = dealerId ? \`(dealerId = "\${dealerId}" || dealer_id = "\${dealerId}")\` : \`dealer_id = "main"\`;
      const records = await pb.collection('monitor_targets').getFullList({ filter });
      return records.map((r: any) => ({
        id: r.id,
        domain: r.domain,
        createdBy: r.created_by,
        createdAt: r.created,
        dealerId: r.dealer_id,
        lat: r.lat,
        lng: r.lng,
        label: r.label
      }));
    } catch (error) {
      return [];
    }
  },

  addMonitorTarget: async (target: MonitorTarget): Promise<void> => {
    try {
      await pb.collection('monitor_targets').create({
        id: target.id,
        domain: target.domain,
        created_by: target.createdBy,
        dealer_id: target.dealerId || 'main',
        lat: target.lat,
        lng: target.lng,
        label: target.label
      });
    } catch (error) {
      console.error('PB: addMonitorTarget error:', error);
    }
  },

  deleteMonitorTarget: async`
);

code = code.replace(
  /deleteLedgerSheet: async \(sheetId: string, tenantId: string = 'main'\) => {[\s\S]*?\/\/ --- Recycle Bin ---/m,
  `deleteLedgerSheet: async (sheetId: string, authorName: string, tenantId: string = 'main') => {
    try {
      const isPbId = typeof sheetId === 'string' && /^[a-z0-9]{15}$/.test(sheetId);
      if (isPbId) {
        let recordData = null;
        try {
          recordData = await pb.collection('ledger_sheets').getOne(sheetId);
        } catch (e) {}

        if (recordData) {
          try {
            await pocketbaseService.saveToRecycleBin('ledger_sheets', sheetId, authorName, tenantId, recordData);
          } catch (err) {}
        }
        await pb.collection('ledger_sheets').delete(sheetId);
      }
    } catch (e) {
      console.error("PB: deleteLedgerSheet error:", e);
    }
  },

  // --- Recycle Bin ---`
);

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
