const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const startIdx = code.indexOf('const handleBatchSaveRecoveryRows = async (): Promise<boolean> => {');
if (startIdx === -1) {
  console.log("Start not found");
  process.exit(1);
}
const endString = '    } catch (err: any) {\n      console.error("Failed to batch save recovery rows:", err);\n      toast.error("Failed to save recovery rows", { description: getCleanErrorMessage(err) });\n      return false;\n    }\n  };';
const endIdx = code.indexOf(endString, startIdx);
if (endIdx === -1) {
  console.log("End not found");
  process.exit(1);
}

const replacement = `const handleBatchSaveRecoveryRows = async (): Promise<boolean> => {
    if (!currentMonthId || editedRowIndices.size === 0) return true;
    try {
      setIsSavingRecoveryRows(true);
      const activeDoc = billingMonths.find(m => m.id === currentMonthId);
      if (!activeDoc || !activeDoc.rows) {
        setIsSavingRecoveryRows(false);
        return false;
      }

      const count = editedRowIndices.size;

      // Save to cloud FIRST, then clear local edits state
      await saveBillingMonthTracked(
        currentMonthId,
        activeDoc.rows,
        currentUser?.username || 'admin',
        activeDealerId || 'main',
        true
      );
      
      savedBillingSnapshotRef.current = JSON.parse(JSON.stringify(activeDoc.rows));
      setEditedRowIndices(new Set());
      
      toast.success("Recovery Edits Saved! 🎉", {
        description: \`\${count} edited row\${count > 1 ? 's' : ''} saved to database.\`
      });

      setIsSavingRecoveryRows(false);
      return true;
    } catch (err: any) {
      setIsSavingRecoveryRows(false);
      console.error("Failed to batch save recovery rows:", err);
      toast.error("Failed to save recovery rows", { description: getCleanErrorMessage(err) });
      return false;
    }
  };`;

const newCode = code.substring(0, startIdx) + replacement + code.substring(endIdx + endString.length);
fs.writeFileSync('src/components/AdminPanel.tsx', newCode);
console.log("Batch Patched successfully");
