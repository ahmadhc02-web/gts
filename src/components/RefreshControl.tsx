import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface RefreshControlProps {
  onRefresh: () => void;
  isLoading?: boolean;
}

const REFRESH_INTERVALS = [
  { label: 'Off', value: 0 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
];

export default function RefreshControl({ onRefresh, isLoading }: RefreshControlProps) {
  const [intervalTime, setIntervalTime] = useState<number>(0);
  const [showOptions, setShowOptions] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const handleManualRefresh = useCallback(() => {
    onRefresh();
    setLastRefreshed(new Date());
  }, [onRefresh]);

  useEffect(() => {
    if (intervalTime === 0) return;

    const timer = setInterval(() => {
      handleManualRefresh();
    }, intervalTime);

    return () => clearInterval(timer);
  }, [intervalTime, handleManualRefresh]);

  const activeInterval = REFRESH_INTERVALS.find(i => i.value === intervalTime);

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          onClick={() => setShowOptions(!showOptions)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest transition-all hover:border-brand-accent/50",
            intervalTime > 0 ? "text-brand-accent border-brand-accent/30" : "text-slate-500"
          )}
        >
          <Clock size={14} className={intervalTime > 0 ? "animate-pulse" : ""} />
          <span>Auto: {activeInterval?.label}</span>
          <ChevronDown size={12} className={cn("transition-transform", showOptions ? "rotate-180" : "")} />
        </button>

        {showOptions && (
          <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl z-[100] overflow-hidden">
            {REFRESH_INTERVALS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setIntervalTime(opt.value);
                  setShowOptions(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                  intervalTime === opt.value ? "text-brand-accent bg-brand-accent/5" : "text-slate-500"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleManualRefresh}
        disabled={isLoading}
        className="group flex items-center gap-2 px-4 py-1.5 rounded-xl bg-brand-accent hover:opacity-90 active:scale-[0.97] text-white transition-all shadow-md shadow-brand-accent/10 border-none disabled:opacity-40 select-none cursor-pointer"
      >
        <RefreshCw size={13} className={cn(isLoading ? "animate-spin" : "group-hover:rotate-180 transition-all duration-500")} />
        <span className="text-[10px] font-black uppercase tracking-widest font-sans">Refresh</span>
      </button>

      <div className="hidden sm:block">
        <span className="text-[9px] font-medium text-slate-400 dark:text-slate-600 uppercase tracking-tighter">
          Last Check: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
