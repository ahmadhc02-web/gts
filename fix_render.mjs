import fs from 'fs';
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /const details = item.details \|\| \{\};\s*const isExpanded = expandedRecycleItem === item.id;\s*const deletedAt = details.deletedAt \|\| item.created_at;/m,
  `const details = (() => {
                          try { return JSON.parse(item.extra_data || '{}'); } catch (e) { return {}; }
                        })();
                        const isExpanded = expandedRecycleItem === item.id;
                        const deletedAt = item.deleted_at || Date.parse(item.created);`
);

code = code.replace(
  /\{details.originalTable \|\| 'Unknown'\}/m,
  `{item.table_name || 'Unknown'}`
);

code = code.replace(
  /\{item.message \|\| "Deleted entry"\}/m,
  `{(() => {
    const title = details.customerName || details.name || details.clientName || details.domain || \`Record \${item.record_id}\`;
    return \`Deleted \${item.table_name} entry: "\${title}"\`;
  })()}`
);

code = code.replace(
  /\{item.author_name \|\| "admin"\}/m,
  `{item.author_name || "admin"}`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
