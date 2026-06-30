import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const docIdFolders = 'ledger_folders_main';
  const docIdMap = 'ledger_sheet_map_main';

  console.log("Fetching data from Supabase...");
  const { data: sheets } = await supabase.from('ledger_sheets').select('id, data');
  const { data: mapData } = await supabase.from('branding_config').select('id, dashboard_subtext').eq('id', docIdMap).maybeSingle();
  const { data: foldersData } = await supabase.from('branding_config').select('id, dashboard_subtext').eq('id', docIdFolders).maybeSingle();

  let map = mapData && mapData.dashboard_subtext ? JSON.parse(mapData.dashboard_subtext) : {};
  let folders = foldersData && foldersData.dashboard_subtext ? JSON.parse(foldersData.dashboard_subtext) : [];

  if (!Array.isArray(folders)) folders = [];
  if (folders.length === 0) {
      folders = [{ id: 'june_data', name: 'June Data', createdAt: Date.now() }];
  }

  let julyFolder = folders.find(f => f.name.toLowerCase().includes('july'));
  if (!julyFolder) {
      julyFolder = { id: `folder_${Date.now()}_july`, name: '1 July Data', createdAt: Date.now() };
      folders.push(julyFolder);
  }

  let juneFolder = folders.find(f => f.name.toLowerCase().includes('june') || f.id === 'june_data');
  if (!juneFolder) {
      juneFolder = { id: 'june_data', name: 'June Data', createdAt: Date.now() };
      folders.push(juneFolder);
  }

  console.log("Processing sheets...");
  if (sheets) {
    sheets.forEach(s => {
      // Map it if it's NOT mapped yet
      if (!map[s.id]) {
        const sheetDate = (s.data?.sheetDate || '').toLowerCase();
        if (sheetDate.includes('jul') || sheetDate.includes('07 -') || sheetDate.includes('july')) {
            map[s.id] = julyFolder.id;
        } else {
            map[s.id] = juneFolder.id;
        }
      }
    });
  }

  console.log("Updating Supabase...");
  await supabase.from('branding_config').upsert({
      id: docIdMap,
      dashboard_subtext: JSON.stringify(map),
      updated_at: Date.now()
  });

  await supabase.from('branding_config').upsert({
      id: docIdFolders,
      dashboard_subtext: JSON.stringify(folders),
      updated_at: Date.now()
  });

  console.log("Sync completed successfully!");
}

run();
