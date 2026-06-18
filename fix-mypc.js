const fs = require('fs');
let file = fs.readFileSync('./src/components/AdminPanel.tsx', 'utf8');
file = file.replace(/grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6/g, 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6');
file = file.replace(/grid grid-cols-1 sm:grid-cols-3 gap-6/g, 'grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6');
file = file.replace(/grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto py-4/g, 'grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-6 max-w-2xl mx-auto py-4');
file = file.replace(/group cursor-pointer p-8 bg-sky-50\/30/g, 'group cursor-pointer p-4 sm:p-8 bg-sky-50/30');

// Fix inner typography so it doesn't wrap weirdly when columns are 2 on mobile
file = file.replace(/text-xs font-black uppercase tracking-widest text-slate-800 dark:text-zinc-100 group-hover:text-sky-500 transition-colors mt-2/g, 'text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-800 dark:text-zinc-100 group-hover:text-sky-500 transition-colors mt-2');
file = file.replace(/text-\[9px\] font-extrabold uppercase tracking-widest text-slate-500 group-hover:text-slate-400 dark:text-zinc-400 transition-colors mt-2/g, 'text-[8px] sm:text-[9px] font-extrabold uppercase tracking-widest text-slate-500 group-hover:text-slate-400 dark:text-zinc-400 transition-colors mt-1 sm:mt-2 line-clamp-2');

// Fix vault icons
file = file.replace(/w-16 h-16 rounded-2xl bg-sky-100\/80/g, 'w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-sky-100/80');

fs.writeFileSync('./src/components/AdminPanel.tsx', file);
