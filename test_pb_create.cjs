const PocketBase = require('pocketbase');
const pb = new PocketBase('http://167.233.41.7:8090');

async function test() {
  try {
    const newUser = {
      uid: 'admin_sys_node_test_' + Date.now(),
      username: 'admin_test_' + Date.now(),
      password: 'admin_password',
      role: 'super_admin',
      created_at: Date.now(),
      dealer_id: 'main',
      created_by: 'system',
      created_by_name: 'System Core Boot',
      status: 'active'
    };
    console.log("Trying to create...");
    const res = await pb.collection('users').create(newUser);
    console.log("Created successfully!", res);
  } catch (err) {
    console.error("Error creating user:", err);
    if (err.data) {
      console.error("Error data:", JSON.stringify(err.data));
    }
  }
}

test();
