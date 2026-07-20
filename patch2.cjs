const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

const target = `    const activeDoc = billingMonths.find(m => m.id === currentMonthId);
    if (!activeDoc) return;

    if (currentMonthId) {
      lastLocalEditTime.current[currentMonthId] = Date.now();
    }

    try {
      const updatedRows = [...(activeDoc.rows || [])];
      const targetRow = { ...updatedRows[rowIndex] };

      targetRow[field] = val;

      if (field === 'cr') {`;

const replacement = `    if (currentMonthId) {
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

        if (field === 'cr') {`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
  console.log("Patched successfully part 1");
} else {
  console.log("Target not found!");
}
