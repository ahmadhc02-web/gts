const fs = require('fs');
let content = fs.readFileSync('src/lib/firebaseService.ts', 'utf8');

const subscribeLedgerFolderMapTarget = `  subscribeLedgerFolderMap: (callback: (map: any) => void, tenantId: string = 'main') => {
    const fetchMap = async () => {
      try {
        const { data, error } = await supabase
          .from('ledger_folders')
          .select('id, name')
          .eq('tenant_id', tenantId);

        if (error) throw error;
        
        const map: any = {};
        if (data) {
          data.forEach(d => {
            map[d.id] = d.name;
          });
        }
        callback(map);
      } catch (e) {
        console.error("Failed to fetch ledger folders:", e);
      }
    };`;

const subscribeLedgerFolderMapReplacement = `  subscribeLedgerFolderMap: (callback: (map: any) => void, tenantId: string = 'main') => {
    const fetchMap = async () => {
      try {
        // pocketbase merge
        let pbMap = null;
        if ((import.meta as any).env.VITE_USE_POCKETBASE === 'true' || true) {
           pbMap = await pocketbaseService.getLedgerFolders(tenantId);
        }

        const { data, error } = await supabase
          .from('ledger_folders')
          .select('id, name')
          .eq('tenant_id', tenantId);

        let map: any = {};
        if (!error && data) {
          data.forEach(d => {
            map[d.id] = d.name;
          });
        }
        
        if (pbMap && Object.keys(pbMap).length > 0) {
           map = pbMap; // prefer pocketbase
        }
        
        callback(map);
      } catch (e) {
        console.error("Failed to fetch ledger folders:", e);
      }
    };`;

content = content.replace(subscribeLedgerFolderMapTarget, subscribeLedgerFolderMapReplacement);

const subscribeLedgerSheetsTarget = `  subscribeLedgerSheets: (callback: (sheets: any[]) => void, tenantId: string = 'main') => {
    const fetchSheets = async () => {
      try {
        const { data, error } = await supabase
          .from('ledger_sheets')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const sheets = (data || []).map(d => {
          let rows = [];
          try {
            rows = typeof d.rows_data === 'string' ? JSON.parse(d.rows_data) : d.rows_data;
          } catch(e) {}
          return {
            id: d.id,
            name: d.name,
            folderId: d.folder_id,
            rows: rows,
            createdAt: new Date(d.created_at).getTime(),
            updatedAt: new Date(d.updated_at).getTime()
          };
        });
        
        callback(sheets);
      } catch (e) {
        console.error("Failed to fetch ledger sheets:", e);
      }
    };`;

const subscribeLedgerSheetsReplacement = `  subscribeLedgerSheets: (callback: (sheets: any[]) => void, tenantId: string = 'main') => {
    const fetchSheets = async () => {
      try {
        let pbSheets = null;
        if ((import.meta as any).env.VITE_USE_POCKETBASE === 'true' || true) {
           pbSheets = await pocketbaseService.getLedgerSheets(tenantId);
        }

        const { data, error } = await supabase
          .from('ledger_sheets')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        let sheets = [];
        if (!error && data) {
          sheets = (data || []).map(d => {
            let rows = [];
            try {
              rows = typeof d.rows_data === 'string' ? JSON.parse(d.rows_data) : d.rows_data;
            } catch(e) {}
            return {
              id: d.id,
              name: d.name,
              folderId: d.folder_id,
              rows: rows,
              createdAt: new Date(d.created_at).getTime(),
              updatedAt: new Date(d.updated_at).getTime()
            };
          });
        }
        
        if (pbSheets && pbSheets.length > 0) {
           sheets = pbSheets;
        }

        callback(sheets);
      } catch (e) {
        console.error("Failed to fetch ledger sheets:", e);
      }
    };`;

content = content.replace(subscribeLedgerSheetsTarget, subscribeLedgerSheetsReplacement);

const updateLedgerFolderMapTarget = `  updateLedgerSheetFolderMap: async (map: any, tenantId: string = 'main') => {
    try {
      // Current Supabase approach: 
      // Fetch existing, delete what's missing, upsert current.`;

const updateLedgerFolderMapReplacement = `  updateLedgerSheetFolderMap: async (map: any, tenantId: string = 'main') => {
    try {
      pocketbaseService.saveLedgerFolders(map, tenantId).catch(e => console.warn("PB skip", e));
      // Current Supabase approach: 
      // Fetch existing, delete what's missing, upsert current.`;

content = content.replace(updateLedgerFolderMapTarget, updateLedgerFolderMapReplacement);

const saveLedgerSheetTarget = `  saveLedgerSheet: async (sheet: any, tenantId: string = 'main') => {
    try {
      const payload = {`;

const saveLedgerSheetReplacement = `  saveLedgerSheet: async (sheet: any, tenantId: string = 'main') => {
    try {
      pocketbaseService.saveLedgerSheet(sheet, tenantId).catch(e => console.warn("PB skip", e));
      const payload = {`;

content = content.replace(saveLedgerSheetTarget, saveLedgerSheetReplacement);

const deleteLedgerSheetTarget = `  deleteLedgerSheet: async (sheetId: string, tenantId: string = 'main') => {
    try {
      // Save to recycle bin first`;

const deleteLedgerSheetReplacement = `  deleteLedgerSheet: async (sheetId: string, tenantId: string = 'main') => {
    try {
      pocketbaseService.deleteLedgerSheet(sheetId, tenantId).catch(e => console.warn("PB skip", e));
      // Save to recycle bin first`;

content = content.replace(deleteLedgerSheetTarget, deleteLedgerSheetReplacement);

fs.writeFileSync('src/lib/firebaseService.ts', content);
console.log("Patched firebaseService with ledger dual writes");
