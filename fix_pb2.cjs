const fs = require('fs');
let content = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

content = content.replace(/}\\s*,\\s*getLedgerFolders:/g, '},\n  getLedgerFolders:');
if (content.includes('}\n  getLedgerFolders:')) {
  content = content.replace(/}\\s*getLedgerFolders:/, '},\n  getLedgerFolders:');
}
fs.writeFileSync('src/lib/pocketbaseService.ts', content);
