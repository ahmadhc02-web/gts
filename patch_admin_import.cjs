const fs = require('fs');
let content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
if (!content.includes('import { pocketbaseService }')) {
  content = content.replace("import { firebaseService } from '../lib/firebaseService';", "import { firebaseService } from '../lib/firebaseService';\nimport { pocketbaseService } from '../lib/pocketbaseService';");
  fs.writeFileSync('src/components/AdminPanel.tsx', content);
}
