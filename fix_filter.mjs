import fs from 'fs';
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /const filteredRecycleItems = useMemo\(\(\) => {[\s\S]*?}, \[recycleItems, recycleSearchTerm\]\);/m,
  `const filteredRecycleItems = useMemo(() => {
    return recycleItems.filter(item => {
      if (!recycleSearchTerm) return true;
      const term = recycleSearchTerm.toLowerCase();
      const tableName = (item.table_name || '').toLowerCase();
      const author = (item.author_name || '').toLowerCase();
      let recordLabel = '';
      try {
        const extra = JSON.parse(item.extra_data || '{}');
        recordLabel = (extra.customerName || extra.name || extra.clientName || '').toLowerCase();
      } catch (e) {}
      return tableName.includes(term) || author.includes(term) || recordLabel.includes(term);
    });
  }, [recycleItems, recycleSearchTerm]);`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
