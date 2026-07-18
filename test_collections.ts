import { pb } from './src/lib/pocketbase';

async function test() {
  const names = [
    'users', 'clients', 'complaints', 'billing_months', 'billing_rows', 
    'users_data', 'user_data', 'notifications', 'branding_config', 
    'categories_config', 'statuses_config', 'priority_config', 'zone_config',
    'ledger_folders', 'ledger_sheets'
  ];
  for (const name of names) {
    try {
      const res = await pb.collection(name).getList(1, 1);
      console.log(`✅ Collection [${name}] exists. Found ${res.totalItems} items.`);
    } catch (err: any) {
      console.log(`❌ Collection [${name}] fails:`, err.message || err);
    }
  }
}

test();
