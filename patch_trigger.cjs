const fs = require('fs');
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

code = code.replace(/if \(activeSyncingMonths\.size > 0\) \{/, `if (pocketbaseService._syncingMonths && pocketbaseService._syncingMonths.size > 0) {`);

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
