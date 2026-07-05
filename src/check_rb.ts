import { supabase } from './supabaseClient';
async function test() {
  console.log("Checking recycle bin...");
  const { error } = await supabase.from('recycle_bin').select('id').limit(1);
  console.log("Result:", { error });
}
test();
