const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://167.233.41.7.sslip.io';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDk5NzQ3LCJleHAiOjIxMDA4NTk3NDd9.lX7sriVJBtEBVeE5LDiBl6OZgpjAw4ZRBNkegBH7uFo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Setting up realtime subscription...");
  const channel = supabase.channel('test-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'billing_months' }, (payload) => {
      console.log('[REALTIME] Change event received:', payload);
      process.exit(0);
    })
    .subscribe((status) => {
      console.log("Subscription status:", status);
      if (status === 'SUBSCRIBED') {
        console.log("Triggering an update to billing_months...");
        supabase.from('billing_months').upsert({
          month_id: 'test_month_123',
          dealer_id: 'main',
          rows_data: [{id: 1}],
          updatedAt: Date.now()
        }).then(({error}) => {
          if (error) console.error("Upsert error:", error);
          else console.log("Upsert successful, waiting for realtime event...");
        });
      }
    });

  setTimeout(() => {
    console.log("Timeout waiting for realtime event. Realtime is NOT working.");
    process.exit(1);
  }, 10000);
}

test();
