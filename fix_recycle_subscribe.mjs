import fs from 'fs';
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

code = code.replace(
  /cleanOldRecycleBinItems: async \(\) => {}\n};/m,
  `cleanOldRecycleBinItems: async () => {},

  subscribeRecycleBin: (callback: (items: any[]) => void, dealerId?: string) => {
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
      dealerId,
      'deleted_at'
    );
  }
};`
);

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
