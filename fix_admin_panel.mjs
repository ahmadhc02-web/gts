import fs from 'fs';
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /const unsubscribe = pocketbaseService.subscribeNotifications\(\(data\) => {[\s\S]*?const items = data.filter\(n => n.type === 'recycle_bin'\);[\s\S]*?setRecycleItems\(items\);[\s\S]*?setIsRecycleLoading\(false\);[\s\S]*?}, currentUser.role !== 'super_admin' \? currentUser.dealerId : undefined\);/m,
  `const unsubscribe = pocketbaseService.subscribeRecycleBin((data) => {
        setRecycleItems(data);
        setIsRecycleLoading(false);
      }, currentUser.role !== 'super_admin' ? currentUser.dealerId : undefined);`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
