import fs from 'fs';
import path from 'path';
import PocketBase from 'pocketbase';

const pocketbaseUrl = 'http://167.233.41.7';
const pocketbaseAdminEmail = 'YOUR_ADMIN_EMAIL_HERE';
const pocketbaseAdminPassword = 'YOUR_ADMIN_PASSWORD_HERE';

async function migrateData() {
  console.log('Starting migration from local JSON to PocketBase...');

  const pb = new PocketBase(pocketbaseUrl);

  try {
    // Authenticate with PocketBase
    console.log('Authenticating with PocketBase...');
    await pb.admins.authWithPassword(pocketbaseAdminEmail, pocketbaseAdminPassword);

    console.log('Reading local complaints_rows.json file...');
    const filePath = path.resolve(process.cwd(), 'complaints_rows.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const allComplaints = JSON.parse(fileContent);

    console.log(`Found ${allComplaints.length} records to migrate.`);

    // Insert into PocketBase
    let successCount = 0;
    let errorCount = 0;

    for (const record of allComplaints) {
      try {
        const dataToInsert = {
          member_id: record.member_id,
          member_name: record.member_name,
          customer_name: record.customer_name,
          customer_username: record.customer_username,
          area: record.area,
          description: record.description,
          phone_number: record.phone_number,
          status: record.status,
          category: record.category,
          priority: record.priority,
          pkg_details: record.pkg_details,
          user_nearby: record.user_nearby,
          panel_details: record.panel_details,
          remarks: record.remarks,
          remark_author_id: record.remark_author_id,
          remark_author_name: record.remark_author_name,
          dealer_id: record.dealer_id,
        };
        
        await pb.collection('complaints').create(dataToInsert);
        console.log(`Successfully inserted row for customer: ${record.customer_username || record.customer_name || 'Unknown'}`);
        successCount++;
      } catch (insertError) {
        console.error(`Error inserting row for customer ${record.customer_username}:`, insertError.message);
        errorCount++;
      }
    }

    console.log('--- Migration Summary ---');
    console.log(`Total Records: ${allComplaints.length}`);
    console.log(`Successfully Migrated: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrateData();
