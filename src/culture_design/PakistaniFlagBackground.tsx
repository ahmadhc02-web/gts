import React from 'react';

export default function PakistaniFlagBackground({ children, className = '' }: { children?: React.ReactNode, className?: string }) {
  const today = new Date();
  const month = today.getMonth(); // 7 for August
  const date = today.getDate();
  const isIndependencePeriod = month === 7 && date >= 4 && date <= 20;

  if (!isIndependencePeriod) {
    return (
      <div className={`relative w-full h-full min-h-screen flex flex-col overflow-x-hidden ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full min-h-screen flex flex-col overflow-x-hidden ${className}`}>
      {/* Background Flag Gradient Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none flex opacity-90 dark:opacity-60">
        {/* Left white section - 25% width, very subtle */}
        <div className="w-1/4 h-full bg-gradient-to-r from-slate-50 to-emerald-50/30 dark:from-slate-950 dark:to-emerald-950/30 transition-colors"></div>
        {/* Right green section - 75% width, light green */}
        <div className="w-3/4 h-full bg-gradient-to-br from-emerald-200/60 via-emerald-200/40 to-emerald-100/30 dark:from-emerald-800/50 dark:via-emerald-900/40 dark:to-emerald-950/30 transition-colors"></div>
      </div>

      {/* Moon and Star SVG on the Right Field */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center sm:justify-end sm:pr-12 md:pr-24 lg:pr-36 xl:pr-48 opacity-25 dark:opacity-30 -translate-y-6 sm:-translate-y-10 transition-all">
        <svg 
          viewBox="0 0 100 100" 
          className="w-[350px] h-[350px] sm:w-[500px] sm:h-[500px] lg:w-[700px] lg:h-[700px] text-emerald-800 dark:text-emerald-300 fill-current transform rotate-45 drop-shadow-md"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Crescent */}
          <path d="M 55 10 A 40 40 0 1 0 95 50 A 45 45 0 1 1 55 10 Z" />
          {/* Star */}
          <polygon points="68,40 76,46 73,36 80,30 71,30 68,22 65,30 56,30 63,36 60,46" />
        </svg>
      </div>

      {/* Content wrapper */}
      <div className="relative z-10 w-full h-full flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
