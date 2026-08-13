import React from 'react';
import { motion } from 'motion/react';

export const PakistanFlagFooter: React.FC = () => {
  const today = new Date();
  const month = today.getMonth(); // 7 for August
  const date = today.getDate();
  const isIndependencePeriod = month === 7 && date >= 4 && date <= 20;

  if (!isIndependencePeriod) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-0 flex opacity-90 dark:opacity-80 shadow-inner">
       {/* Left White Strip */}
       <div className="w-[15%] sm:w-[20%] h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/50 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-100/50 via-transparent to-slate-200/40 dark:from-slate-800/30 dark:to-transparent" />
       </div>
       {/* Right Green Field */}
       <div className="w-[85%] sm:w-[80%] h-full bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/60 dark:to-emerald-800/40 relative overflow-hidden">
         {/* Moon and star */}
         <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-25 dark:opacity-[0.35]">
            <svg viewBox="0 0 100 100" className="w-24 h-24 sm:w-32 sm:h-32 text-emerald-700 dark:text-emerald-300 fill-current transform rotate-45">
              <path d="M 55 10 A 40 40 0 1 0 95 50 A 45 45 0 1 1 55 10 Z" />
              <polygon points="68,40 76,46 73,36 80,30 71,30 68,22 65,30 56,30 63,36 60,46" />
            </svg>
         </div>
       </div>
       {/* Gold Decorative Border Stripes at Top & Bottom */}
       <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-slate-200 via-emerald-400 to-amber-400 z-10 opacity-70" />
    </div>
  );
};
export default PakistanFlagFooter;
