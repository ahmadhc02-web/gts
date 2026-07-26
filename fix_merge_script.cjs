const fs = require('fs');
let code = fs.readFileSync('src/components/EntrySheet.tsx', 'utf8');

const target1 = `        const mergedRowsSync = [...currentPrevRows];
        for (const accRow of accumulatedRows) {
           const idx = mergedRowsSync.findIndex(r => 
             (r.clientId && accRow.clientId && r.clientId === accRow.clientId) ||
             (r.username && accRow.username && r.username.toLowerCase() === accRow.username.toLowerCase()) || 
             (r.name && accRow.name && r.name.toLowerCase() === accRow.name.toLowerCase()) 
           );
           if (idx !== -1) {
             mergedRowsSync[idx] = accRow;
           } else {
             mergedRowsSync.push(accRow);
           }
        }
        finalMergedRows = mergedRowsSync;`;

const replace1 = `        // Since accumulatedRows is a complete copy of the month's rows with updates,
        // and merging by name/id is dangerous for duplicates, we should just use accumulatedRows directly.
        // It already contains all previous rows plus the new updates.
        finalMergedRows = accumulatedRows;`;

const target2 = `            const mergedRows = [...prevRows];
            for (const accRow of accumulatedRows) { 
               const idx = mergedRows.findIndex(r => 
                 (r.clientId && accRow.clientId && r.clientId === accRow.clientId) ||
                 (r.username && accRow.username && r.username.toLowerCase() === accRow.username.toLowerCase()) || 
                 (r.name && accRow.name && r.name.toLowerCase() === accRow.name.toLowerCase()) 
               );
               if (idx !== -1) {
                 mergedRows[idx] = accRow;
               } else {
                 mergedRows.push(accRow);
               }
            }`;

const replace2 = `            const mergedRows = accumulatedRows;`;

// Remove whitespace and check if present
const normalize = s => s.replace(/\s+/g, '');
if (normalize(code).includes(normalize(target1))) {
   let startIdx = code.indexOf('        const mergedRowsSync = [...currentPrevRows];');
   let endIdx = code.indexOf('finalMergedRows = mergedRowsSync;') + 'finalMergedRows = mergedRowsSync;'.length;
   
   if(startIdx !== -1 && endIdx !== -1) {
       code = code.substring(0, startIdx) + replace1 + code.substring(endIdx);
   }
}

if (normalize(code).includes(normalize(target2))) {
   let startIdx = code.indexOf('            const mergedRows = [...prevRows];');
   let endIdx = code.indexOf('                 mergedRows.push(accRow);\n               }\n            }') + '                 mergedRows.push(accRow);\n               }\n            }'.length;
   
   if(startIdx !== -1 && endIdx !== -1) {
       code = code.substring(0, startIdx) + replace2 + code.substring(endIdx);
   }
}

fs.writeFileSync('src/components/EntrySheet.tsx', code);
console.log('Replaced correctly');
