import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  if (error) console.error("Error:", error);
  else console.log("Keys:", data.length ? Object.keys(data[0]) : "No data");
}
main();
