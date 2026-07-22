import fs from 'fs';
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

code = code.replace(
  /restoreFromRecycleBin: async \(recycleBinItemId: string\) => {},/m,
  `restoreFromRecycleBin: async (recycleBinItemId: string) => {
    try {
      const recycleRecord = await pb.collection('recycle_bin').getOne(recycleBinItemId);
      if (!recycleRecord || !recycleRecord.extra_data) {
        throw new Error("No extra data found to restore.");
      }
      const data = JSON.parse(recycleRecord.extra_data);
      const tableName = recycleRecord.table_name;
      
      // Some fields like id, created, updated shouldn't be overridden if they are auto-generated, but PocketBase allows setting 'id' on creation if it's 15 chars. 
      // If it fails, we omit 'id'. We will try to create with the exact data.
      // The extra_data contains the full PocketBase record.
      
      try {
        await pb.collection(tableName).create(data);
      } catch (err) {
        // If it fails, maybe the id is invalid or already exists, try without id
        const { id, created, updated, collectionId, collectionName, ...rest } = data;
        await pb.collection(tableName).create({ id, ...rest }); // Try with id but without readonly fields
      }
      
      // Clean up from recycle bin
      await pb.collection('recycle_bin').delete(recycleBinItemId);
      return true;
    } catch (e) {
      console.error("PB: restoreFromRecycleBin error:", e);
      throw e;
    }
  },`
);

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
