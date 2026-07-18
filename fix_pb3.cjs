const fs = require('fs');
let content = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

const lines = content.split('\n');
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('getLedgerFolders: async')) {
    if (lines[i-1].trim() === '}') {
      lines[i-1] = '  },';
    }
  }
}
fs.writeFileSync('src/lib/pocketbaseService.ts', lines.join('\n'));
