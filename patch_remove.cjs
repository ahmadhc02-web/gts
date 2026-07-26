const fs = require('fs');
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

code = code.replace(/activeSyncingMonths\.add\(monthId\);\n?/g, '');
code = code.replace(/activeSyncingMonths\.delete\(monthId\);\n?/g, '');

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
