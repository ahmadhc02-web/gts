const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

const regex = /const handleSaveRowField = async [\s\S]*?toast\.error\("Cell local edit issue".*?\n    \}\n  \};/;
const replacement = `const handleSaveRowField = async (rowIndex: number, field: string, val: any) => {
    if (!isBillingUnlocked && field !== 'billingDay' && field !== 'comments') {
      toast.error("🔒 ACCESS PROTECTED", { description: "Please enter the Security Key to edit billing information." });
      return;
    }

    if (currentMonthId) {
      lastLocalEditTime.current[currentMonthId] = Date.now();
    }

    try {
      setBillingMonths(prev => {
        const activeDocIndex = prev.findIndex(m => m.id === currentMonthId);
        if (activeDocIndex === -1) return prev;
        
        const activeDoc = prev[activeDocIndex];
        const updatedRows = [...(activeDoc.rows || [])];
        if (!updatedRows[rowIndex]) return prev;

        const targetRow = { ...updatedRows[rowIndex] };
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

        updatedRows[rowIndex] = targetRow;
        const newPrev = [...prev];
        newPrev[activeDocIndex] = { ...activeDoc, rows: updatedRows };
        
        // Persist permanently in PocketBase in background using latest
        pocketbaseService.saveBillingMonth(currentMonthId, updatedRows, currentUser.username || 'admin', activeDealerId).catch(err => {
           console.error("Failed to persist billing cell edit:", err);
           toast.error("Cell auto-save issue", { description: "Changes may not have synced to cloud." });
        });
        
        return newPrev;
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Cell local edit issue", { description: getCleanErrorMessage(err) });
    }
  };`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
  console.log("Patched successfully part 4");
} else {
  console.log("Target regex not found!");
}
