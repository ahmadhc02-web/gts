const fs = require('fs');
let code = fs.readFileSync('src/components/EntrySheet.tsx', 'utf8');

const target = `        let finalMergedRows: any[] = [];
        if (setBillingMonths) {
          setBillingMonths(prev => {
            const activeDocIndex = prev.findIndex(m => m.id === monthId);
            let prevRows: any[] = [];
            if (activeDocIndex !== -1) {
              prevRows = prev[activeDocIndex].rows || [];
            } else if (billingMonths) {
              const existingInProps = billingMonths.find(m => m.id === monthId);
              if (existingInProps) prevRows = existingInProps.rows || [];
            }
            
            // Merge accumulatedRows into prevRows so we don't lose concurrent changes
            const mergedRows = [...prevRows];
            for (const accRow of accumulatedRows) { 
               const idx = mergedRows.findIndex(r => 
                 (r.clientId && accRow.clientId && r.clientId === accRow.clientId) ||
                 (r.username && accRow.username && r.username.toLowerCase() === accRow.username.toLowerCase()) || 
                 (r.name && accRow.name && r.name.toLowerCase() === accRow.name.toLowerCase()) 
               );
               if (idx !== -1) {
                 mergedRows[idx] = accRow; // overwrite with A4 edit
               } else {
                 mergedRows.push(accRow);
               }
            }
            finalMergedRows = mergedRows;

            if (activeDocIndex !== -1) {
              const newPrev = [...prev];
              newPrev[activeDocIndex] = { ...prev[activeDocIndex], rows: mergedRows };
              return newPrev;
            } else {
              return [{ id: monthId, rows: mergedRows, createdAt: Date.now(), updatedAt: Date.now() }, ...prev];
            }
          });
        } else {
          finalMergedRows = accumulatedRows;
        }`;

const replace = `        let finalMergedRows: any[] = [];
        let currentPrevRows: any[] = [];
        if (billingMonths) {
          const existingInProps = billingMonths.find(m => m.id === monthId);
          if (existingInProps) currentPrevRows = existingInProps.rows || [];
        }
        
        const mergedRowsSync = [...currentPrevRows];
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
        finalMergedRows = mergedRowsSync;

        if (setBillingMonths) {
          setBillingMonths(prev => {
            const activeDocIndex = prev.findIndex(m => m.id === monthId);
            let prevRows: any[] = [];
            if (activeDocIndex !== -1) {
              prevRows = prev[activeDocIndex].rows || [];
            } else if (billingMonths) {
              const existingInProps = billingMonths.find(m => m.id === monthId);
              if (existingInProps) prevRows = existingInProps.rows || [];
            }
            
            const mergedRows = [...prevRows];
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
            }

            if (activeDocIndex !== -1) {
              const newPrev = [...prev];
              newPrev[activeDocIndex] = { ...prev[activeDocIndex], rows: mergedRows };
              return newPrev;
            } else {
              return [{ id: monthId, rows: mergedRows, createdAt: Date.now(), updatedAt: Date.now() }, ...prev];
            }
          });
        }`;

// Remove whitespace and check if present
const normalize = s => s.replace(/\s+/g, '');
if (normalize(code).includes(normalize(target))) {
   // let's do a smart replace
   let startIdx = code.indexOf('        let finalMergedRows: any[] = [];');
   let endIdx = code.indexOf('        } else {\n          finalMergedRows = accumulatedRows;\n        }') + '        } else {\n          finalMergedRows = accumulatedRows;\n        }'.length;
   
   if(startIdx !== -1 && endIdx !== -1) {
       let newCode = code.substring(0, startIdx) + replace + code.substring(endIdx);
       fs.writeFileSync('src/components/EntrySheet.tsx', newCode);
       console.log('Replaced successfully via script');
   } else {
       console.log('Indexes not found, fallback to regex');
   }
} else {
   console.log('Target not found even normalized');
}
