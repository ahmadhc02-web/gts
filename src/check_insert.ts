import { supabase } from './supabaseClient';
async function test() {
  const payload = {
    id: 'test_insert_' + Date.now(),
    dashboard_subtext: '{}',
    updated_at: Date.now()
  };
  const { error } = await supabase.from('branding_config').insert(payload);
  console.log("Result:", { error });
}
test();
