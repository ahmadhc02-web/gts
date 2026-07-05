import { supabase } from './supabaseClient';
async function main() {
  const { data, error } = await supabase.from('users').update({ gender: 'male' }).eq('uid', 'some-id');
  if (error) console.error("Error:", error);
  else console.log("Success!");
}
main();
