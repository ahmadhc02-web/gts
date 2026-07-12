import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import fs from 'fs';

// Read config
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function restore() {
  console.log("Reading data.txt...");
  let content;
  try {
    content = fs.readFileSync('data.txt', 'utf8');
  } catch (e) {
    console.error("Error: Please create 'data.txt' in the root folder, paste the data there, and try again.");
    process.exit(1);
  }

  const arrays = [];
  let bracketCount = 0;
  let currentArray = '';
  let inString = false;
  let escape = false;

  console.log("Parsing JSON arrays...");
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      if (bracketCount > 0) currentArray += char;
    } else {
      if (char === '"') {
        inString = true;
        if (bracketCount > 0) currentArray += char;
      } else if (char === '[') {
        bracketCount++;
        if (bracketCount === 1) {
          currentArray = '[';
        } else {
          currentArray += char;
        }
      } else if (char === ']') {
        bracketCount--;
        currentArray += char;
        if (bracketCount === 0) {
          try {
            arrays.push(JSON.parse(currentArray));
          } catch (e) {
            console.error('Failed to parse an array');
          }
          currentArray = '';
        }
      } else {
        if (bracketCount > 0) currentArray += char;
      }
    }
  }

  console.log(`Found ${arrays.length} collections to restore.`);

  for (let i = 0; i < arrays.length; i++) {
    const arr = arrays[i];
    if (!arr || arr.length === 0) continue;
    
    const first = arr[0];
    let collectionName = '';

    if (first.config_type !== undefined) collectionName = 'branding_config';
    else if (first.month_id !== undefined) collectionName = 'users_data';
    else if (first.uid !== undefined && first.role !== undefined) collectionName = 'users';
    else if (first.rec_officer !== undefined || (first.id && first.id.startsWith('sheet_'))) collectionName = 'ledger_sheets';
    else if (first.pkg_details !== undefined && first.user_nearby !== undefined) collectionName = 'clients';
    else if (first.member_id !== undefined && first.customer_name !== undefined) collectionName = 'complaints';
    else {
      console.log(`Unknown collection for array ${i}, skipping...`, first);
      continue;
    }

    console.log(`Restoring ${arr.length} items to '${collectionName}'...`);
    
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const item of arr) {
      const docId = item.id || item.uid;
      if (!docId) continue;
      
      const docRef = doc(collection(db, collectionName), String(docId));
      batch.set(docRef, item, { merge: true });
      batchCount++;

      if (batchCount === 400) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
    console.log(`Finished restoring ${collectionName}.`);
  }

  console.log("All data restored successfully!");
  process.exit(0);
}

restore().catch(console.error);
