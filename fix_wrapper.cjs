const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// Replace the broken wrapper with the correct one
const brokenWrapperRegex = /const saveBillingMonthTracked = async \(monthId: string, rows: any\[\], updatedBy: string, dealerId: string = 'main', forceImmediate: boolean = false\) => \{\s+try \{\s+await saveBillingMonthTracked\(monthId, rows, updatedBy, dealerId, forceImmediate\);\s+\} finally \{\s+\}\s+\};/m;

const correctWrapper = `
  const saveBillingMonthTracked = async (monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main', forceImmediate: boolean = false) => {
    savingMonthIds.current.add(monthId);
    try {
      await pocketbaseService.saveBillingMonth(monthId, rows, updatedBy, dealerId, forceImmediate);
    } finally {
      savingMonthIds.current.delete(monthId);
    }
  };
`;

code = code.replace(brokenWrapperRegex, correctWrapper);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
