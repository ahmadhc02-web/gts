import fs from 'fs';
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

code = code.replace(
  /\(row\) => row,\s*dealerId,\s*'deleted_at'/m,
  `(row) => row, dealerId`
);

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
