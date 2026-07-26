const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const startIdx = code.indexOf('const handleSaveRowField = (rowIndex: number, field: string, val: any, forceImmediate = false) => {');
if (startIdx === -1) {
  console.log("Start not found");
  process.exit(1);
}

const endString = '    } catch (err: any) {\n      console.error(err);\n    }\n  };';
const endIdx = code.indexOf(endString, startIdx);
if (endIdx === -1) {
  console.log("End not found");
  process.exit(1);
}

const replacement = `const handleSaveRowField = (rowIndex: number, field: string, val: any, forceImmediate = false) => {
    if (!isBillingUnlocked && field !== 'billingDay' && field !== 'comments') {
      toast.error("🔒 ACCESS PROTECTED", { description: "Please enter the Security Key to edit billing information." });
      return;
    }

    if (!currentMonthId) return;

    try {
      setBillingMonths(prev => {
        const idx = prev.findIndex(m => m.id === currentMonthId);
        if (idx === -1) return prev;
        
        const next = [...prev];
        const nextRows = [...(next[idx].rows || [])];
        if (!nextRows[rowIndex]) return prev;

        if (nextRows[rowIndex][field] === val) return prev;

        const targetRow = { ...nextRows[rowIndex] };
        targetRow[field] = val;

        if (field === 'cr') {
          const crVal = parseFloat(val) || 0;
          targetRow._originalCr = crVal;
          targetRow.cr = crVal;
          const base = parseFloat(targetRow.baseAmount) || 0;
          targetRow.totalAmount = base + crVal;
        } else if (field === 'baseAmount') {
          const baseVal = parseFloat(val) || 0;
          const crVal = parseFloat(targetRow.cr) || 0;
          targetRow.totalAmount = baseVal + crVal;
        } else if (field === 'paymentReceived') {
          const received = parseFloat(val) || 0;
          targetRow.paymentReceived = received;
        } else if (field === 'paymentStatus') {
          if (val === 'tdc' || val === 'dc') {
            targetRow.baseAmount = 0;
            const crVal = parseFloat(targetRow.cr) || 0;
            targetRow.totalAmount = crVal;
          }
        }

        if (field === 'paymentReceived' || field === 'baseAmount' || field === 'cr') {
          const received = parseFloat(targetRow.paymentReceived) || 0;
          const total = parseFloat(targetRow.totalAmount) || 0;
          
          if (targetRow.paymentStatus !== 'tdc' && targetRow.paymentStatus !== 'dc') {
            if (received === 0) {
              targetRow.paymentStatus = 'unpaid';
            } else if (received >= total) {
              targetRow.paymentStatus = 'paid';
            } else {
              targetRow.paymentStatus = 'partial';
            }
          }
        }

        nextRows[rowIndex] = targetRow;
        next[idx] = { ...next[idx], rows: nextRows };
        return next;
      });

      setEditedRowIndices(prev => {
        const next = new Set(prev);
        next.add(rowIndex);
        return next;
      });
      
    } catch (err: any) {
      console.error(err);
    }
  };`;

const newCode = code.substring(0, startIdx) + replacement + code.substring(endIdx + endString.length);
fs.writeFileSync('src/components/AdminPanel.tsx', newCode);
console.log("Patched successfully");
