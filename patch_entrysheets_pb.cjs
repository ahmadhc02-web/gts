const fs = require('fs');
let content = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

const targetAdd = `  // --- BILLING CONFIG & RECOVERY SHEETS ---`;
const replaceAdd = `  // --- ENTRY SHEETS (LEDGER) ---
  async getLedgerFolders(tenantId: string = 'main') {
    try {
      const records = await pb.collection('ledger_folders').getFullList({ filter: \`tenant_id = "\${tenantId}"\` });
      if (!records || records.length === 0) return null;
      // return as a map of folderId -> folderName
      const map: any = {};
      for (const r of records) {
        map[r.folder_id] = r.folder_name;
      }
      return map;
    } catch(e) {
      console.warn("PB: Failed to fetch ledger folders", e);
      return null;
    }
  },

  async saveLedgerFolders(map: any, tenantId: string = 'main') {
    try {
      const existing = await pb.collection('ledger_folders').getFullList({ filter: \`tenant_id = "\${tenantId}"\` });
      for (const ex of existing) {
        await pb.collection('ledger_folders').delete(ex.id).catch(() => {});
      }
      for (const [folderId, folderName] of Object.entries(map)) {
        await pb.collection('ledger_folders').create({ folder_id: folderId, folder_name: folderName, tenant_id: tenantId }).catch(() => {});
      }
    } catch(e) {}
  },

  async getLedgerSheets(tenantId: string = 'main') {
    try {
      const records = await pb.collection('ledger_sheets').getFullList({ filter: \`tenant_id = "\${tenantId}"\` });
      if (!records || records.length === 0) return null;
      return records.map(r => ({
         id: r.sheet_id,
         name: r.name,
         folderId: r.folder_id,
         rows: r.rows_data,
         createdAt: r.created_at,
         updatedAt: r.updated_at
      }));
    } catch(e) {
      console.warn("PB: Failed to fetch ledger sheets", e);
      return null;
    }
  },

  async saveLedgerSheet(sheet: any, tenantId: string = 'main') {
    try {
      const filter = \`sheet_id = "\${sheet.id}" && tenant_id = "\${tenantId}"\`;
      const existing = await pb.collection('ledger_sheets').getList(1, 1, { filter });
      if (existing.items.length > 0) {
        await pb.collection('ledger_sheets').update(existing.items[0].id, {
          name: sheet.name,
          folder_id: sheet.folderId,
          rows_data: sheet.rows,
          updated_at: sheet.updatedAt || Date.now()
        }).catch(() => {});
      } else {
        await pb.collection('ledger_sheets').create({
          sheet_id: sheet.id,
          name: sheet.name,
          folder_id: sheet.folderId,
          rows_data: sheet.rows,
          created_at: sheet.createdAt || Date.now(),
          updated_at: sheet.updatedAt || Date.now(),
          tenant_id: tenantId
        }).catch(() => {});
      }
    } catch(e) {}
  },

  async deleteLedgerSheet(sheetId: string, tenantId: string = 'main') {
    try {
      const filter = \`sheet_id = "\${sheetId}" && tenant_id = "\${tenantId}"\`;
      const existing = await pb.collection('ledger_sheets').getList(1, 1, { filter });
      if (existing.items.length > 0) {
        await pb.collection('ledger_sheets').delete(existing.items[0].id).catch(() => {});
      }
    } catch(e) {}
  },

  // --- BILLING CONFIG & RECOVERY SHEETS ---`;

content = content.replace(targetAdd, replaceAdd);
fs.writeFileSync('src/lib/pocketbaseService.ts', content);
console.log("Patched pocketbaseService with ledger methods");
