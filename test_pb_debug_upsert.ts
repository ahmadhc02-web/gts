import { pb } from './src/lib/pocketbase';
import { toDb } from './src/lib/pocketbaseService';

async function test() {
  const collectionName = 'users';
  const idField = 'uid';
  const idValue = 'admin_sys_node';
  
  const newUser = {
    uid: 'admin_sys_node',
    username: 'admin',
    password: 'admin',
    role: 'super_admin',
    createdAt: Date.now(),
    dealerId: 'main',
    createdBy: 'system',
    createdByName: 'System Core Boot',
    status: 'active'
  };

  const dbRow = {
    uid: 'admin_sys_node',
    username: 'admin',
    password: 'admin',
    role: 'super_admin',
    created_at: Date.now(),
    dealer_id: 'main',
    created_by: 'system',
    created_by_name: 'System Core Boot',
    status: 'active'
  };

  try {
    console.log("1. Finding existing...");
    const existing = await pb.collection(collectionName).getFirstListItem(`${idField} = "${idValue}"`);
    console.log("Found existing record:", existing.id);
    
    console.log("2. Trying to update...");
    const updateRes = await pb.collection(collectionName).update(existing.id, dbRow);
    console.log("Updated successfully!", updateRes);
  } catch (err: any) {
    console.error("Update failed with error:", err);
    if (err.data) {
      console.error("Update error data:", JSON.stringify(err.data));
    }
    
    // Let's also try create
    try {
      console.log("3. Trying to create...");
      const createRes = await pb.collection(collectionName).create({ ...dbRow, [idField]: idValue });
      console.log("Created successfully!", createRes);
    } catch (createErr: any) {
      console.error("Create failed with error:", createErr);
      if (createErr.data) {
        console.error("Create error data:", JSON.stringify(createErr.data));
      }
    }
  }
}

test();
