const fs = require('fs');
let file = fs.readFileSync('./src/components/AdminPanel.tsx', 'utf8');

// 1. Fix subfolder grids
file = file.replace(/className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-6xl mx-auto py-4"/g, 'className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 max-w-6xl mx-auto py-4"');
file = file.replace(/className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto py-4"/g, 'className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 max-w-4xl mx-auto py-4"');
file = file.replace(/className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto py-4"/g, 'className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-6 max-w-2xl mx-auto py-4"');

// 2. Fix subfolder padding
file = file.replace(/className="group cursor-pointer p-8 bg-sky-50\/30 dark:bg-sky-950\/15 backdrop-blur-xl border border-sky-200\/60/g, 'className="group cursor-pointer p-3 sm:p-8 bg-sky-50/30 dark:bg-sky-950/15 backdrop-blur-xl border border-sky-200/60');

// 3. Fix subfolder icon sizing
file = file.replace(/className="w-16 h-16 rounded-2xl bg-sky-100\/80 dark:bg-sky-950\/50 border border-sky-300\/50/g, 'className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-sky-100/80 dark:bg-sky-950/50 border border-sky-300/50');
file = file.replace(/size=\{28\} className=\"stroke-\[1\.5\]\"/g, 'size={24} className="stroke-[1.5] w-5 h-5 sm:w-7 sm:h-7"');

// 4. Fix typography
file = file.replace(/className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-zinc-100 group-hover:text-sky-500 transition-colors mt-2"/g, 'className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-800 dark:text-zinc-100 group-hover:text-sky-500 transition-colors mt-1.5 sm:mt-2 text-center leading-tight"');
file = file.replace(/className="text-\[9px\] font-extrabold uppercase tracking-widest text-slate-500 group-hover:text-slate-400 dark:text-zinc-400 transition-colors mt-2"/g, 'className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-widest text-slate-500 group-hover:text-slate-400 dark:text-zinc-400 transition-colors mt-1 sm:mt-2 line-clamp-2 text-center leading-tight"');

fs.writeFileSync('./src/components/AdminPanel.tsx', file);
console.log('Fixed MyPC layout!');
