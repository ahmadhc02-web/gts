import { createClient } from '@supabase/supabase-js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const SUPABASE_URL = 'https://jduamzoyllfspdqucncw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWFtem95bGxmc3BkcXVjbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzc0MzcsImV4cCI6MjA5NTg1MzQzN30.7H-fW0weeqVu9Pr0_KHxOZkmbnypZSdXi1YsIcYlkVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const mappings = {
  users: {
    uid: 'uid',
    username: 'username',
    password: 'password',
    role: 'role',
    fullName: 'full_name',
    createdAt: 'created_at',
    lastActive: 'last_active',
    dealerId: 'dealer_id',
    lineCode: 'line_code',
    createdBy: 'created_by',
    createdByName: 'created_by_name',
    companyName: 'company_name',
    status: 'status',
    profilePicture: 'profile_picture',
    email: 'email'
  },
  complaints: {
    id: 'id',
    memberId: 'member_id',
    memberName: 'member_name',
    customerName: 'customer_name',
    customerUsername: 'customer_username',
    area: 'area',
    description: 'description',
    number: 'phone_number',
    status: 'status',
    category: 'category',
    priority: 'priority',
    pkgDetails: 'pkg_details',
    userNearby: 'user_nearby',
    panelDetails: 'panel_details',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    remarks: 'remarks',
    remarkAuthorId: 'remark_author_id',
    remarkAuthorName: 'remark_author_name',
    customerReview: 'customer_review',
    reviews: 'customer_review',
    dealerId: 'dealer_id',
    scheduledAt: 'scheduled_at'
  },
  clients: {
    id: 'id',
    name: 'name',
    username: 'username',
    number: 'number',
    mobileNumber: 'mobile_number',
    seriesNumber: 'series_number',
    area: 'area',
    status: 'status',
    password: 'password',
    ipAddress: 'ip_address',
    brand: 'brand',
    dealerId: 'dealer_id',
    boxNumber: 'box_number',
    installationAddress: 'installation_address',
    cnic: 'cnic',
    fee: 'fee',
    deposit: 'deposit',
    lineCode: 'line_code',
    macAddress: 'mac_address',
    package: 'package',
    connectionDate: 'connection_date',
    deviceOwnedBy: 'device_owned_by',
    port: 'port',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    latitude: 'latitude',
    longitude: 'longitude',
    mapUrl: 'map_url'
  },
  chat_groups: {
    id: 'id',
    name: 'name',
    createdBy: 'created_by',
    createdAt: 'created_at',
    members: 'members',
    isPrivate: 'is_private'
  },
  chat_messages: {
    id: 'id',
    groupId: 'group_id',
    senderId: 'sender_id',
    senderName: 'sender_name',
    text: 'text',
    timestamp: 'timestamp',
    readBy: 'read_by',
    type: 'type',
    fileUrl: 'file_url',
    fileName: 'file_name',
    fileType: 'file_type',
    fileSize: 'file_size'
  },
  notifications: {
    id: 'id',
    userId: 'user_id',
    title: 'title',
    message: 'message',
    read: 'read',
    timestamp: 'timestamp',
    link: 'link',
    type: 'type'
  },
  monitor_targets: {
    id: 'id',
    name: 'name',
    ipAddress: 'ip_address',
    status: 'status',
    lastChecked: 'last_checked',
    createdAt: 'created_at',
    createdBy: 'created_by'
  },
  ledger_sheets: {
    id: 'id',
    dealerId: 'dealer_id',
    title: 'title',
    createdAt: 'created_at',
    rows: 'rows'
  },
  branding_config: {
    id: 'id',
    appName: 'app_name',
    appLogo: 'app_logo',
    primaryColor: 'primary_color',
    secondaryColor: 'secondary_color',
    accentColor: 'accent_color',
    headerTitle: 'header_title',
    headerSubtitle: 'header_subtitle',
    loginBgImage: 'login_bg_image',
    loginFooterText: 'login_footer_text',
    updatedAt: 'updated_at',
    updatedBy: 'updated_by'
  }
};

const toCamelCase = (snakeCaseObj, tableMapping) => {
  const camelCaseObj = {};
  for (const [camelKey, snakeKey] of Object.entries(tableMapping)) {
    if (snakeCaseObj[snakeKey] !== undefined) {
      if (snakeKey === 'created_at' || snakeKey === 'updated_at' || snakeKey === 'last_active' || snakeKey === 'timestamp' || snakeKey === 'scheduled_at') {
        const val = snakeCaseObj[snakeKey];
        if (typeof val === 'string') {
          camelCaseObj[camelKey] = new Date(val).getTime();
        } else {
          camelCaseObj[camelKey] = val;
        }
      } else {
        camelCaseObj[camelKey] = snakeCaseObj[snakeKey];
      }
    }
  }
  return camelCaseObj;
};

async function migrateTable(tableName, mapping, idField = 'id') {
  console.log(`Migrating ${tableName}...`);
  let allRecords = [];
  let from = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + limit - 1);
      
    if (error) {
      console.error(`Error fetching ${tableName}:`, error.message);
      break;
    }
    
    if (!data || data.length === 0) {
      break;
    }
    
    allRecords = allRecords.concat(data);
    
    if (data.length < limit) {
      break;
    }
    
    from += limit;
  }
  
  console.log(`Found ${allRecords.length} records for ${tableName}.`);
  
  let batch = writeBatch(db);
  let batchCount = 0;
  
  for (const record of allRecords) {
    const firestoreData = toCamelCase(record, mapping);
    const docId = firestoreData[idField === 'uid' ? 'uid' : 'id'] || record[mapping[idField] || idField] || record.id || record.uid;
    if (!docId) {
      console.warn(`Record in ${tableName} has no ID, skipping:`, record);
      continue;
    }
    
    const docRef = doc(collection(db, tableName), String(docId));
    batch.set(docRef, firestoreData, { merge: true });
    batchCount++;
    
    if (batchCount === 500) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  
  if (batchCount > 0) {
    await batch.commit();
  }
  console.log(`Finished migrating ${tableName}.`);
}

async function run() {
  for (const [tableName, mapping] of Object.entries(mappings)) {
    const idField = tableName === 'users' ? 'uid' : 'id';
    await migrateTable(tableName, mapping, idField);
  }
  
  // also migrate 'deleted_records' if it exists in supabase
  const { data: dr } = await supabase.from('deleted_records').select('*');
  if (dr && dr.length > 0) {
     console.log(`Found ${dr.length} deleted_records.`);
     let batch = writeBatch(db);
     let batchCount = 0;
     for (const r of dr) {
       const docId = r.id;
       const docRef = doc(collection(db, 'deleted_records'), String(docId));
       // Parse data JSON
       let parsedData = r.data;
       try { if(typeof r.data === 'string') parsedData = JSON.parse(r.data); } catch(e){}
       batch.set(docRef, {
         id: r.id,
         type: r.type,
         identifier: r.identifier,
         deletedBy: r.deleted_by,
         dealerId: r.dealer_id,
         data: parsedData,
         deletedAt: new Date(r.deleted_at).getTime()
       });
       batchCount++;
       if(batchCount === 500) { await batch.commit(); batch = writeBatch(db); batchCount = 0; }
     }
     if (batchCount > 0) await batch.commit();
  }
  console.log('Migration Complete.');
  process.exit(0);
}

run().catch(console.error);
