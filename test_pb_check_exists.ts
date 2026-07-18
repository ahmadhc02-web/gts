import { pb } from './src/lib/pocketbase';

async function test() {
  try {
    const list = await pb.collection('users').getFullList({
      filter: 'username = "admin" || uid = "admin_sys_node"'
    });
    console.log("Matching users:", list.map(u => ({ id: u.id, uid: u.uid, username: u.username })));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
