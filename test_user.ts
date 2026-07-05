import { supabase } from './src/lib/firebase';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log("URL:", process.env.VITE_SUPABASE_URL ? "Exists" : "No");
  // Let's import the same supabase client the app uses:
  const { supabase } = await import('./src/supabaseClient.ts');
  const { data, error } = await supabase.from('users').select('*').limit(1);
  if (error) console.error("Error:", error);
  else console.log("User DB keys:", data[0] ? Object.keys(data[0]) : "Empty");
}
main();
