import fs from 'fs';
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /\{details.originalId\}/m,
  `{item.record_id}`
);

code = code.replace(
  /\{JSON.stringify\(details.originalData, null, 2\)\}/m,
  `{JSON.stringify(details, null, 2)}`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
