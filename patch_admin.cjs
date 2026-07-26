const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// Insert saveBillingMonthTracked after `const savingMonthIds = React.useRef<Set<string>>(new Set());`
const insertPoint = `const savingMonthIds = React.useRef<Set<string>>(new Set());`;
const wrapperCode = `
  const saveBillingMonthTracked = async (monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main', forceImmediate: boolean = false) => {
    savingMonthIds.current.add(monthId);
    try {
      await pocketbaseService.saveBillingMonth(monthId, rows, updatedBy, dealerId, forceImmediate);
    } finally {
      savingMonthIds.current.delete(monthId);
    }
  };
`;
if (!code.includes('saveBillingMonthTracked')) {
  code = code.replace(insertPoint, insertPoint + '\n' + wrapperCode);
}

// Remove all savingMonthIds.current.add and savingMonthIds.current.delete calls (they will be handled by the wrapper)
code = code.replace(/savingMonthIds\.current\.add\([^)]+\);\n?/g, '');
code = code.replace(/savingMonthIds\.current\.delete\([^)]+\);\n?/g, '');
code = code.replace(/savingMonthIds\.current\.has\([^)]+\)/g, (match) => {
    return match; // keep .has()
});

// Now replace pocketbaseService.saveBillingMonth(...) with saveBillingMonthTracked(...)
// It could be called with await, without await, with .catch() etc.
// The easiest is string replacement.
code = code.replace(/pocketbaseService\.saveBillingMonth\(/g, 'saveBillingMonthTracked(');

// Also need to make sure we don't break finally block removals if they are empty
code = code.replace(/\.finally\(\(\) => \{\s*\}\)/g, '');

fs.writeFileSync('src/components/AdminPanel.tsx', code);
