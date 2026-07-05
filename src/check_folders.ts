import { supabase } from './supabaseClient';
async function test() {
  console.log("Checking folder update...");
  const docId = 'ledger_folders_main';
  const { data: beforeData } = await supabase.from('branding_config').select('dashboard_subtext').eq('id', docId).single();
  console.log("Before:", beforeData);
  
  const payload = {
    id: docId,
    dashboard_subtext: beforeData ? beforeData.dashboard_subtext : '[]',
    updated_at: Date.now()
  };
  const { data, error } = await supabase.from('branding_config').upsert(payload);
  console.log("Result:", { error });
}
test();
