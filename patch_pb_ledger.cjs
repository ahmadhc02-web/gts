const fs = require('fs');
let content = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

if (!content.includes('getLedgerFolders: async')) {
  content = content.replace(/};\s*$/, `
  getLedgerFolders: async (tenantId: string = 'main') => {
    try {
      const records = await pb.collection('ledger_folders').getFullList({ filter: \`tenant_id = "\${tenantId}"\` });
      const map: any = {};
      records.forEach((r: any) => { map[r.folder_id] = r.name; });
      return map;
    } catch(e) { return {}; }
  },
  saveLedgerFolders: async (map: any, tenantId: string = 'main') => {
    try {
      const existing = await pb.collection('ledger_folders').getFullList({ filter: \`tenant_id = "\${tenantId}"\` });
      for (const ex of existing) { await pb.collection('ledger_folders').delete(ex.id).catch(()=>{}); }
      for (const key in map) {
         await pb.collection('ledger_folders').create({ folder_id: key, name: map[key], tenant_id: tenantId }).catch(()=>{});
      }
    } catch(e) {}
  },
  getLedgerSheets: async (tenantId: string = 'main') => {
    try {
      const records = await pb.collection('ledger_sheets').getFullList({ filter: \`tenant_id = "\${tenantId}"\` });
      return records.map((r: any) => ({
        id: r.sheet_id,
        name: r.name,
        folderId: r.folder_id,
        rows: typeof r.rows_data === 'string' ? JSON.parse(r.rows_data) : r.rows_data,
        createdAt: new Date(r.created).getTime(),
        updatedAt: new Date(r.updated).getTime()
      }));
    } catch(e) { return []; }
  },
  saveLedgerSheet: async (sheet: any, tenantId: string = 'main') => {
    try {
      const filter = \`sheet_id = "\${sheet.id}" && tenant_id = "\${tenantId}"\`;
      const existing = await pb.collection('ledger_sheets').getList(1, 1, { filter });
      const payload = {
         sheet_id: sheet.id,
         name: sheet.name,
         folder_id: sheet.folderId,
         rows_data: JSON.stringify(sheet.rows),
         tenant_id: tenantId
      };
      if (existing.items.length > 0) {
         await pb.collection('ledger_sheets').update(existing.items[0].id, payload);
      } else {
         await pb.collection('ledger_sheets').create(payload);
      }
    } catch(e) {}
  },
  deleteLedgerSheet: async (sheetId: string, tenantId: string = 'main') => {
    try {
      const filter = \`sheet_id = "\${sheetId}" && tenant_id = "\${tenantId}"\`;
      const existing = await pb.collection('ledger_sheets').getList(1, 1, { filter });
      if (existing.items.length > 0) {
         await pb.collection('ledger_sheets').delete(existing.items[0].id);
      }
    } catch(e) {}
  }
};
`);
  fs.writeFileSync('src/lib/pocketbaseService.ts', content);
  console.log('patched');
} else {
  console.log('already patched');
}
