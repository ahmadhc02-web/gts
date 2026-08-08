process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ignore self-signed cert
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const channel = supabase.channel('test-channel-4', { config: { presence: { key: 'test' } } })
    .on('presence', { event: 'sync' }, () => {
      console.log('Presence sync received!');
    })
    .subscribe((status) => {
      console.log("Subscription status:", status);
      if (status === 'SUBSCRIBED') {
        console.log("Successfully subscribed to presence!");
        process.exit(0);
      }
    });

  setTimeout(() => {
    process.exit(1);
  }, 3000);
}
test();
