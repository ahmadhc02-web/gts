import fs from 'fs';
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /\{details.originalTable\}/m,
  `{item.table_name}`
);

code = code.replace(
  /\{details.recordId\}/m,
  `{item.record_id}`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
