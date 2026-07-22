import fs from 'fs';
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

code = code.replace(
  /subscribeRecycleBin: \(callback: \(items: any\[\]\) => void, dealerId\?: string\) => \{\s*return subscribeTable\(\s*'recycle_bin',\s*\(items\) => \{[\s\S]*?callback\(filtered\);\s*\},\s*dealerId,\s*'deleted_at'\s*\);\s*\}/m,
  `subscribeRecycleBin: (callback: (items: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'recycle_bin',
      (items) => {
        let filtered = items;
        if (dealerId && dealerId !== 'main') {
          filtered = filtered.filter((n: any) => n.dealer_id === dealerId || n.dealerId === dealerId);
        }
        filtered.sort((a, b) => b.deleted_at - a.deleted_at);
        callback(filtered);
      },
      (row) => row,
      dealerId,
      'deleted_at'
    );
  }`
);

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
