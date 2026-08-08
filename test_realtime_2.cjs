const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://167.233.41.7.sslip.io';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDk5NzQ3LCJleHAiOjIxMDA4NTk3NDd9.lX7sriVJBtEBVeE5LDiBl6OZgpjAw4ZRBNkegBH7uFo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const channel = supabase.channel('test-channel-2')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config' }, (payload) => {
      console.log('[REALTIME] Change event received:', payload);
      process.exit(0);
    })
    .subscribe((status) => {
      console.log("Subscription status:", status);
    });

  setTimeout(() => {
    process.exit(1);
  }, 3000);
}
test();
