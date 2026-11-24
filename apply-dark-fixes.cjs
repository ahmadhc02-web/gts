const fs = require('fs');

const files = [
  'src/components/VertixDashboard.tsx',
  'src/components/vertix/PackagesView.tsx',
  'src/components/vertix/VouchersView.tsx',
  'src/components/vertix/PaymentsView.tsx',
  'src/components/vertix/ManagersView.tsx',
  'src/components/vertix/NasView.tsx',
  'src/components/vertix/ReportsView.tsx',
  'src/components/vertix/LogsView.tsx',
  'src/components/vertix/SmsView.tsx',
  'src/components/vertix/SettingsView.tsx',
  'src/components/vertix/ui.tsx',
];

const replacements = [
  // Checkbox contrast
  [
    'className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500 cursor-pointer"',
    'className="rounded border-slate-300 dark:border-[#234036] dark:bg-[#16271f] text-emerald-600 focus:ring-emerald-500 cursor-pointer"'
  ],
  [
    'className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"',
    'className="rounded border-slate-300 dark:border-[#234036] dark:bg-[#16271f] text-emerald-600 focus:ring-emerald-500 cursor-pointer"'
  ],

  // Table row hovers
  [
    "hover:bg-slate-50/80 dark:hover:bg-slate-800/40",
    "hover:bg-emerald-50/40 dark:hover:bg-[#12211c]"
  ],
  [
    'hover:bg-black/5 dark:hover:bg-white/5',
    'hover:bg-emerald-50/50 dark:hover:bg-[#12211c]'
  ],
  [
    'dark:hover:bg-slate-800/40',
    'dark:hover:bg-[#12211c]'
  ],
  [
    'hover:bg-slate-100 dark:hover:bg-slate-800',
    'hover:bg-slate-100 dark:hover:bg-[#16271f]'
  ],

  // Dark border consistency for modals & panels
  [
    "isDarkMode ? 'bg-[#0f1b17] border-slate-700",
    "isDarkMode ? 'bg-[#0f1b17] border-[#234036]"
  ],
  [
    "isDarkMode ? 'bg-[#12211c] border-slate-700",
    "isDarkMode ? 'bg-[#12211c] border-[#234036]"
  ],
  [
    "isDarkMode ? 'bg-[#16271f] border-slate-700",
    "isDarkMode ? 'bg-[#16271f] border-[#234036]"
  ],
  [
    'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40',
    'border border-slate-200 dark:border-[#234036] bg-slate-50 dark:bg-[#16271f]'
  ],
  [
    'bg-slate-50 dark:bg-slate-800/40',
    'bg-slate-50 dark:bg-[#16271f]'
  ],
  [
    'bg-slate-100 dark:bg-slate-800 text-xs',
    'bg-slate-100 dark:bg-[#16271f] text-xs'
  ],
  [
    'bg-slate-100 dark:bg-slate-800 border',
    'bg-slate-100 dark:bg-[#16271f] border border-slate-200 dark:border-[#234036]'
  ],
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  let count = 0;
  for (const [from, to] of replacements) {
    if (code.includes(from)) {
      const parts = code.split(from);
      count += parts.length - 1;
      code = parts.join(to);
    }
  }
  fs.writeFileSync(file, code, 'utf8');
  console.log(`Applied ${count} dark mode enhancements to ${file}`);
});
