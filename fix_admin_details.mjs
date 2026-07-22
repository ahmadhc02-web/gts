import fs from 'fs';
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /const details = \(\(\) => \{[\s\S]*?try \{ return JSON.parse\(item.extra_data \|\| '\{\}'\); \} catch \(e\) \{ return \{\}; \}[\s\S]*?\}\)\(\);/m,
  `const extraParsed = (() => {
                          try { return JSON.parse(item.extra_data || '{}'); } catch (e) { return {}; }
                        })();
                        const details = extraParsed.originalData ? extraParsed.originalData : extraParsed;`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
