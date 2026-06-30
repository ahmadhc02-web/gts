import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: sheets } = await supabase.from('ledger_sheets').select('id, data');
  const { data: mapData } = await supabase.from('branding_config').select('id, dashboard_subtext').eq('id', 'ledger_sheet_map_main').maybeSingle();
  const { data: foldersData } = await supabase.from('branding_config').select('id, dashboard_subtext').eq('id', 'ledger_folders_main').maybeSingle();

  console.log("Total sheets:", sheets?.length);
  const map = mapData ? JSON.parse(mapData.dashboard_subtext) : {};
  const folders = foldersData ? JSON.parse(foldersData.dashboard_subtext) : [];
  
  console.log("Folders:", folders);
  
  const recentSheets = sheets.filter(s => {
    const d = s.data.createdAt || 0;
    return Date.now() - d < 48 * 60 * 60 * 1000;
  });
  
  console.log("Recent sheets created in last 48h:");
  recentSheets.forEach(s => {
    console.log(`- ID: ${s.id}, Date: ${s.data.sheetDate}, Area: ${s.data.area}, Folder: ${map[s.id]}`);
  });
}
run();
