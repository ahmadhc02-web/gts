import { supabase } from '../supabaseClient';

async function check() {
  const { data: d1 } = await supabase.from('clients').select('lat, lng').eq('id', 'client_gx25pmbau');
  console.log("Before:", d1);
  const { data, error } = await supabase.from('clients').update({ lat: 31.5, lng: 74.3 }).eq('id', 'client_gx25pmbau');
  const { data: d2 } = await supabase.from('clients').select('lat, lng').eq('id', 'client_gx25pmbau');
  console.log("After:", d2);
}

check();
