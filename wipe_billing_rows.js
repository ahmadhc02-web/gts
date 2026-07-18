const fetch = require('node-fetch');

async function wipe() {
  const loginRes = await fetch('https://gts-isp-management.pockethost.io/api/admins/auth-with-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'ahmadhc02@gmail.com', password: 'Ahmad1122' })
  });
  if (!loginRes.ok) {
    const text = await loginRes.text();
    console.error("Login failed:", text);
    return;
  }
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log("Authenticated...");
  
  let totalDeleted = 0;
  
  while(true) {
    const res = await fetch('https://gts-isp-management.pockethost.io/api/collections/billing_rows/records?page=1&perPage=500', {
      headers: { 'Authorization': token }
    });
    const data = await res.json();
    if(!data.items || data.items.length === 0) break;
    
    console.log(`Deleting batch of ${data.items.length} records...`);
    const promises = data.items.map(r => 
      fetch(`https://gts-isp-management.pockethost.io/api/collections/billing_rows/records/${r.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': token }
      })
    );
    await Promise.all(promises);
    totalDeleted += data.items.length;
    console.log(`Deleted ${totalDeleted} records so far...`);
  }
  console.log(`Done! Total deleted: ${totalDeleted}`);
}
wipe();
