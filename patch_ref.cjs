const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const target = 'const [editedRowIndices, setEditedRowIndices] = useState<Set<number>>(new Set());';
const replacement = `const [editedRowIndices, _setEditedRowIndices] = useState<Set<number>>(new Set());
  const editedRowIndicesRef = React.useRef<Set<number>>(new Set());
  const setEditedRowIndices = (val: any) => {
    _setEditedRowIndices(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      editedRowIndicesRef.current = next;
      return next;
    });
  };`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
  console.log("Ref Patched successfully");
} else {
  console.log("Target not found");
}
