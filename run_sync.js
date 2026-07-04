import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

const SUPABASE_URL = 'https://jduamzoyllfspdqucncw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWFtem95bGxmc3BkcXVjbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzc0MzcsImV4cCI6MjA5NTg1MzQzN30.7H-fW0weeqVu9Pr0_KHxOZkmbnypZSdXi1YsIcYlkVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const docIdFolders = 'ledger_folders_main';
  const docIdMap = 'ledger_sheet_map_main';

  console.log("Fetching data from Supabase...");
  const { data: sheets } = await supabase.from('ledger_sheets').select('*');
  const { data: mapData } = await supabase.from('branding_config').select('id, dashboard_subtext').eq('id', docIdMap).maybeSingle();
  const { data: foldersData } = await supabase.from('branding_config').select('id, dashboard_subtext').eq('id', docIdFolders).maybeSingle();

  let map = mapData && mapData.dashboard_subtext ? JSON.parse(mapData.dashboard_subtext) : {};
  let folders = foldersData && foldersData.dashboard_subtext ? JSON.parse(foldersData.dashboard_subtext) : [];

  if (!Array.isArray(folders)) folders = [];
  
  const julyFolderId = "folder_1782822316447_zm8i1";
  const juneFolderId = "june_data";

  let julyFolder = folders.find(f => f.id === julyFolderId || f.name.toLowerCase().includes('july'));
  if (!julyFolder) {
      julyFolder = { id: julyFolderId, name: '1 July Data', createdAt: Date.now() };
      folders.push(julyFolder);
  } else {
      julyFolder.id = julyFolderId;
      julyFolder.name = '1 July Data';
  }

  let juneFolder = folders.find(f => f.id === juneFolderId || f.name.toLowerCase().includes('june'));
  if (!juneFolder) {
      juneFolder = { id: juneFolderId, name: 'June Data', createdAt: Date.now() };
      folders.push(juneFolder);
  } else {
      juneFolder.id = juneFolderId;
      juneFolder.name = 'June Data';
  }

  // Filter to keep only standard June/July folders to prevent clutter
  folders = folders.filter((f) => f.id === juneFolderId || f.id === julyFolderId);

  const isJulySheet = (sDate) => {
    const clean = (sDate || '').toLowerCase().trim();
    if (clean.includes('july') || clean.includes('jul')) return true;
    const parts = clean.split('-');
    if (parts.length >= 2) {
      const month = parts[1].trim();
      if (month === '07' || month === '7') return true;
    }
    return false;
  };

  console.log("Processing sheets...");
  if (sheets) {
    sheets.forEach(s => {
      // Map it if it's NOT mapped yet
      if (!map[s.id]) {
        const sheetDate = (s.sheet_date || '').toLowerCase();
        if (isJulySheet(sheetDate)) {
            map[s.id] = julyFolderId;
        } else {
            map[s.id] = juneFolderId;
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
