const fs = require('fs');
let content = fs.readFileSync('src/lib/firebaseService.ts', 'utf8');

// updateLedgerFolders
if (!content.includes('pocketbaseService.saveLedgerFolders')) {
  content = content.replace(
    'dashboard_subtext: JSON.stringify(folders),\n      updated_at: Date.now()\n    };',
    `dashboard_subtext: JSON.stringify(folders),
      updated_at: Date.now()
    };
    
    // Sync Pocketbase
    try {
      const map = {};
      folders.forEach(f => { map[f.id] = f.name; });
      pocketbaseService.saveLedgerFolders(map, dealerId || 'main').catch(e => console.warn("PB skip", e));
    } catch(e) {}`
  );
}

// saveLedgerSheet
if (!content.includes('pocketbaseService.saveLedgerSheet')) {
  content = content.replace(
    `const { error } = await supabase.from('ledger_sheets').upsert(dbRow);\n      if (error) throw error;`,
    `const { error } = await supabase.from('ledger_sheets').upsert(dbRow);
      if (error) throw error;
      
      // Sync Pocketbase
      pocketbaseService.saveLedgerSheet(dataToSave, dataToSave.dealerId || 'main').catch(e => console.warn("PB skip", e));`
  );
}

// deleteLedgerSheet
if (!content.includes('pocketbaseService.deleteLedgerSheet')) {
  content = content.replace(
    `await supabase.from('ledger_sheets').delete().eq('id', sheetId);`,
    `// Fetch first to get dealer_id
      const { data: exSheet } = await supabase.from('ledger_sheets').select('dealer_id').eq('id', sheetId).maybeSingle();
      const tenantId = exSheet?.dealer_id || 'main';
      await supabase.from('ledger_sheets').delete().eq('id', sheetId);
      
      // Sync Pocketbase
      pocketbaseService.deleteLedgerSheet(sheetId, tenantId).catch(e => console.warn("PB skip", e));`
  );
}

fs.writeFileSync('src/lib/firebaseService.ts', content);
