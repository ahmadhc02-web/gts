import { pocketbaseService } from './src/lib/pocketbaseService';

async function test() {
  try {
    console.log("Calling getUsers...");
    const users = await pocketbaseService.getUsers();
    console.log("getUsers count:", users.length);
    console.log("First user:", users[0]);
  } catch (err) {
    console.error("getUsers error:", err);
  }
}

test();
