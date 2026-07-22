import fs from 'fs';
let code = fs.readFileSync('src/components/EntrySheet.tsx', 'utf8');

code = code.replace(
  /await pocketbaseService.deleteLedgerSheet\(sheetId\);/g,
  `const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined);
      await pocketbaseService.deleteLedgerSheet(sheetId, currentUser?.username || currentUser?.fullName || 'admin', scopeId || 'main');`
);

fs.writeFileSync('src/components/EntrySheet.tsx', code);
