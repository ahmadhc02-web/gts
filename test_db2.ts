import { supabase } from './src/supabaseClient';
async function main() {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  if (error) console.error("Error:", error);
  else console.log("Keys:", data.length ? Object.keys(data[0]) : "No data");
}
main();
