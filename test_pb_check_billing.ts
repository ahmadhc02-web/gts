import { pb } from './src/lib/pocketbase';

async function test() {
  try {
    console.log("Checking user_data collection:");
    const records = await pb.collection('user_data').getFullList();
    console.log("user_data size:", records.length);
    const months = new Set(records.map(r => r.month_id));
    console.log("user_data month_ids:", Array.from(months));
  } catch (err) {
    console.error("user_data Error:", err);
  }

  try {
    console.log("\nChecking users_data collection:");
    const records = await pb.collection('users_data').getFullList();
    console.log("users_data size:", records.length);
    const months = new Set(records.map(r => r.month_id));
    console.log("users_data month_ids:", Array.from(months));
  } catch (err) {
    console.error("users_data Error:", err);
  }
}

test();
