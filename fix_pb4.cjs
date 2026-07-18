const fs = require('fs');
let content = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

content = content.replace(/}\\s*getLedgerFolders:/g, '},\n  getLedgerFolders:');
fs.writeFileSync('src/lib/pocketbaseService.ts', content);
