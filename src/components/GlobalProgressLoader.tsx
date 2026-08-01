import React from 'react';
import { useLoading } from '../contexts/LoadingContext';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, Activity, CloudUpload } from 'lucide-react';

export const GlobalProgressLoader: React.FC = () => {
  const { isLoading, progress, currentLabel, operationsCount } = useLoading();

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.92, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed bottom-4 left-4 z-[9999] pointer-events-none select-none"
        >
          <div className="flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-2xl bg-slate-950/95 backdrop-blur-2xl border border-slate-700/90 shadow-[0_16px_40px_rgba(0,0,0,0.6)] shadow-cyan-950/30 text-slate-100 min-w-[280px] max-w-[340px] pointer-events-auto">
            {/* Header row with icon, label, and percentage */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex items-center justify-center shrink-0 w-9 h-9 rounded-xl bg-cyan-950/90 border border-cyan-500/40 text-cyan-400 shadow-inner">
                  {progress === 100 ? (
                    <motion.div initial={{ scale: 0.4 }} animate={{ scale: 1.1 }} transition={{ type: 'spring' }}>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </motion.div>
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                  )}
                  {/* Glowing aura */}
                  <span className={`absolute inset-0 rounded-xl ${progress === 100 ? 'bg-emerald-500/20 animate-pulse' : 'bg-cyan-500/20 animate-ping'}`} />
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-100 truncate tracking-wide">
                      {currentLabel || 'Syncing Data...'}
                    </span>
                    {operationsCount > 1 && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-extrabold rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                        {operationsCount} active
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                    {progress === 100 ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Sync Complete
                      </span>
                    ) : (
                      <span className="text-cyan-300/90 flex items-center gap-1">
                        <CloudUpload className="w-3 h-3 text-cyan-400 animate-bounce" /> Database Saving & Syncing
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Percentage badge */}
              <div className="shrink-0 text-right">
                <span className={`text-base font-black font-mono tracking-tight ${progress === 100 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]'}`}>
                  {progress}%
                </span>
              </div>
            </div>

            {/* Progress bar line */}
            <div className="relative w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800 p-[1px]">
              <motion.div
                className={`h-full rounded-full transition-all duration-100 ease-out ${
                  progress === 100
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-400 shadow-[0_0_14px_rgba(16,185,129,0.9)]'
                    : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]'
                }`}
                style={{ width: `${progress}%` }}
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: 'easeOut', duration: 0.1 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalProgressLoader;
