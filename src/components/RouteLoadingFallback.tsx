import React from 'react';
import { motion } from 'motion/react';

export default function RouteLoadingFallback() {
  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="relative flex items-center justify-center">
        {/* Outer glowing pulsing ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-16 h-16 rounded-full border-2 border-transparent border-t-emerald-500 border-r-sky-500 opacity-80"
        />
        {/* Inner pulsing glow */}
        <motion.div
          animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.4, 0.9, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="absolute w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500/30 to-sky-500/30 blur-sm"
        />
        {/* Center dot */}
        <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mt-4 flex flex-col items-center gap-1.5"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">
            GTS Core Relay
          </span>
        </div>
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-400">
          Loading module interface...
        </p>
      </motion.div>
    </div>
  );
}
