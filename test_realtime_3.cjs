const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const channel = supabase.channel('test-channel-3')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'billing_months' }, (payload) => {
      console.log('[REALTIME] Change event received:', payload);
      process.exit(0);
    })
    .subscribe((status) => {
      console.log("Subscription status:", status);
      if (status === 'SUBSCRIBED') {
        supabase.from('billing_months').upsert({
          month_id: 'test_month_123',
          dealer_id: 'main',
          rows_data: [{id: 1}],
          updatedAt: Date.now()
        }).then(({error}) => {
          if (error) console.error("Upsert error:", error);
          else console.log("Upsert successful");
        });
      }
    });

  setTimeout(() => {
    process.exit(1);
  }, 3000);
}
test();
