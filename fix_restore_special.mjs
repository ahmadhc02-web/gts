import fs from 'fs';
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

code = code.replace(
  /restoreFromRecycleBin: async \(recycleBinItemId: string\) => \{[\s\S]*?return true;\s*\} catch \(e\) \{/m,
  `restoreFromRecycleBin: async (recycleBinItemId: string) => {
    try {
      const recycleRecord = await pb.collection('recycle_bin').getOne(recycleBinItemId);
      if (!recycleRecord || !recycleRecord.extra_data) {
        throw new Error("No extra data found to restore.");
      }
      
      const extraParsed = JSON.parse(recycleRecord.extra_data);
      const isFolder = recycleRecord.table_name === 'ledger_folder';
      
      if (isFolder) {
        const folder = extraParsed.originalData;
        const tenantId = extraParsed.dealerId || recycleRecord.dealer_id || 'main';
        
        // Fetch current folders
        const docId = \`ledger_folders_\${tenantId}\`;
        let currentFolders = [];
        try {
          const res = await pb.collection('branding_config').getFirstListItem(\`config_type = "\${docId}"\`);
          if (res && res.dashboard_subtext) {
            currentFolders = JSON.parse(res.dashboard_subtext);
          }
        } catch (e) {}
        
        currentFolders.push(folder);
        await pocketbaseService.saveLedgerFolders(currentFolders, tenantId);
        
      } else {
        const data = extraParsed.originalData ? extraParsed.originalData : extraParsed;
        const tableName = recycleRecord.table_name;
        
        try {
          await pb.collection(tableName).create(data);
        } catch (err) {
          const { id, created, updated, collectionId, collectionName, ...rest } = data;
          await pb.collection(tableName).create({ id, ...rest });
        }
      }
      
      // Clean up from recycle bin
      await pb.collection('recycle_bin').delete(recycleBinItemId);
      return true;
    } catch (e) {`
);

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
