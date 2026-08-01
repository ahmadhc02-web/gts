const SUPABASE_URL = "https://167.233.41.7.sslip.io";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.B3XThD78O8O5v5_p_qRlhvXy_Xq6Zp3P5I8eW5j8Uio";

async function test() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users_data?select=*`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    console.log(res.status, await res.text());
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
test();
