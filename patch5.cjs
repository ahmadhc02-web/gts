const fs = require('fs');
let code = fs.readFileSync('src/components/EntrySheet.tsx', 'utf-8');

const regex = /      for \(const \[monthId, accumulatedRows\] of Object\.entries\(accumulatedBillingMonths\)\) \{\n        if \(setBillingMonths\) \{\n          if \(lastLocalEditTime && lastLocalEditTime\.current\) \{\n            lastLocalEditTime\.current\[monthId\] = Date\.now\(\);\n          \}\n          setBillingMonths\(prev => \n            prev\.map\(m => m\.id === monthId \? \{ \.\.\.m, rows: accumulatedRows \} : m\)\n          \);\n        \}\n        await pocketbaseService\.saveBillingMonth\(\n          monthId, \n          accumulatedRows, \n          currentUser\.username \|\| 'admin',\n          activeDealerId,\n          true\n        \);\n      \}/;
const replacement = `      for (const [monthId, accumulatedRows] of Object.entries(accumulatedBillingMonths)) {
        if (setBillingMonths) {
          if (lastLocalEditTime && lastLocalEditTime.current) {
            lastLocalEditTime.current[monthId] = Date.now();
          }
          
          setBillingMonths(prev => {
            const activeDocIndex = prev.findIndex(m => m.id === monthId);
            if (activeDocIndex === -1) return prev;
            
            const activeDoc = prev[activeDocIndex];
            const prevRows = activeDoc.rows || [];
            
            // Merge accumulatedRows into prevRows so we don't lose concurrent changes
            const mergedRows = [...prevRows];
            for (const accRow of accumulatedRows) {
               const idx = mergedRows.findIndex(r => (r.clientId && r.clientId === accRow.clientId) || (r.username && r.username.toLowerCase() === accRow.username?.toLowerCase()));
               if (idx !== -1) {
                 mergedRows[idx] = accRow; // overwrite with A4 edit
               } else {
                 mergedRows.push(accRow);
               }
            }
            
            const newPrev = [...prev];
            newPrev[activeDocIndex] = { ...activeDoc, rows: mergedRows };
            
            pocketbaseService.saveBillingMonth(
              monthId, 
              mergedRows, 
              currentUser.username || 'admin',
              activeDealerId,
              true
            ).catch(err => {
              console.warn("Failed to save billing month background sync:", err);
            });
            
            return newPrev;
          });
        }
      }`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/components/EntrySheet.tsx', code);
  console.log("Patched successfully part 5");
} else {
  console.log("Target regex not found!");
}
