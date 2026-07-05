import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
if (!supabaseUrl) {
  console.log("No URL");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);
async function test() {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  console.log("Keys:", data && data.length ? Object.keys(data[0]) : "No data", "Error:", error);
}
test();
