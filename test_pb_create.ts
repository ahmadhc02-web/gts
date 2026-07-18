import PocketBase from 'pocketbase';

const pb = new PocketBase('http://167.233.41.7:8090');

async function test() {
  try {
    const newUser = {
      uid: 'admin_sys_node_test_' + Math.random().toString(36).substr(2, 5),
      username: 'admin_test_' + Math.random().toString(36).substr(2, 5),
      password: 'admin_password',
      role: 'super_admin',
      created_at: Date.now(),
      dealer_id: 'main',
      created_by: 'system',
      created_by_name: 'System Core Boot',
      status: 'active'
    };
    console.log("Trying to create user directly on pocketbase...");
    const res = await pb.collection('users').create(newUser);
    console.log("Created successfully!", res);
  } catch (err: any) {
    console.error("Error creating user:", err);
    if (err.data) {
      console.error("Error data:", JSON.stringify(err.data));
    }
  }
}

test();
