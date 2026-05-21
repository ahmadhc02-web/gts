import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface FiberLoadingProps {
  className?: string;
  fullScreen?: boolean;
}

export default function FiberLoading({ className, fullScreen = false }: FiberLoadingProps) {
  const [progress, setProgress] = React.useState(0);
  const [statusIndex, setStatusIndex] = React.useState(0);
  
  const statuses = [
    "Splicing Optical Fiber",
    "Calibrating Matrix",
    "Initializing Neural Uplink",
    "Syncing Data Fragments",
    "Verifying Protocols"
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + Math.random() * 2;
      });
    }, 50);

    const statusTimer = setInterval(() => {
      setStatusIndex(prev => (prev + 1) % statuses.length);
    }, 1500);

    return () => {
      clearInterval(timer);
      clearInterval(statusTimer);
    };
  }, []);

  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-8",
      fullScreen && "fixed inset-0 z-[10000] bg-slate-950 backdrop-blur-xl",
      className
    )}>
      <div className="relative w-72 h-32 flex items-center justify-center">
        {/* Optical Glow Core */}
        <div className="absolute w-24 h-24 bg-brand-accent/20 rounded-full blur-3xl animate-pulse" />
        
        {/* Left Fiber */}
        <motion.div
          initial={{ x: -150, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ 
            duration: 1.2, 
            repeat: Infinity, 
            repeatType: "reverse",
            ease: "easeInOut" 
          }}
          className="absolute left-0 w-36 h-[2px] bg-gradient-to-r from-transparent via-brand-accent to-white rounded-full"
        >
          {/* Connector Head */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-brand-accent rounded-[2px] border border-white/50 shadow-[0_0_20px_rgba(59,130,246,1)]" />
        </motion.div>

        {/* Right Fiber */}
        <motion.div
          initial={{ x: 150, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ 
            duration: 1.2, 
            repeat: Infinity, 
            repeatType: "reverse",
            ease: "easeInOut" 
          }}
          className="absolute right-0 w-36 h-[2px] bg-gradient-to-l from-transparent via-blue-400 to-white rounded-full"
        >
          {/* Connector Head */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-400 rounded-[2px] border border-white/50 shadow-[0_0_20px_rgba(96,165,250,1)]" />
        </motion.div>

        {/* Neural Junction Spark */}
        <motion.div
          animate={{ 
            scale: [0.8, 1.5, 0.8],
            opacity: [0.2, 1, 0.2],
            rotate: [0, 90, 180]
          }}
          transition={{ 
            duration: 1.2, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="relative w-10 h-10 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-white rounded-full blur-xl" />
          <div className="absolute w-2 h-16 bg-white/20 blur-md rotate-45" />
          <div className="absolute w-2 h-16 bg-white/20 blur-md -rotate-45" />
        </motion.div>
        
        {/* Data Geometric Pulses */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={'geom-'+i}
            initial={{ scale: 0.5, opacity: 0, rotate: 45 }}
            animate={{ scale: [0.5, 2, 3], opacity: [0, 0.6, 0] }}
            transition={{ 
              duration: 2, 
              delay: i * 0.5,
              repeat: Infinity, 
              ease: "easeOut" 
            }}
            className="absolute w-20 h-20 border border-brand-accent/40 rounded-lg"
          />
        ))}
      </div>

      <div className="w-full max-w-xs space-y-6 px-4">
        <div className="text-center space-y-3">
          <motion.div
            key={statusIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="h-5"
          >
            <p className="text-white font-black text-[10px] uppercase tracking-[0.5em] font-mono">
              {statuses[statusIndex]}
            </p>
          </motion.div>
          
          <div className="flex justify-center gap-1.5 opacity-50">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={'dots-'+i}
                animate={{ 
                  scale: [1, 1.5, 1],
                  bg: i * 20 <= progress ? "var(--brand-accent)" : "#334155"
                }}
                transition={{ duration: 0.8, delay: i * 0.1, repeat: Infinity }}
                className={cn(
                  "w-1 h-1 rounded-full",
                  i * 20 <= progress ? "bg-brand-accent" : "bg-slate-700"
                )}
              />
            ))}
          </div>
        </div>

        {/* Functional Progress Bar */}
        <div className="space-y-4">
          <div className="flex justify-between items-end px-1">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none">System Status</span>
              <span className="text-[10px] font-black text-white/80 uppercase tracking-tighter mt-1">
                {Math.floor(progress) < 30 ? "Protocol: Handshake" : 
                 Math.floor(progress) < 60 ? "Registry: Syncing" : 
                 Math.floor(progress) < 90 ? "Network: Calibrating" : "Security: Authorized"}
              </span>
            </div>
            <span className="text-xl font-black text-brand-accent font-mono italic leading-none">{Math.floor(progress)}%</span>
          </div>
          
          <div className="relative">
            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 p-[1px]">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-brand-accent via-blue-400 to-white rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]"
              />
            </div>
            {/* Scan Line on progress bar */}
            <motion.div 
              animate={{ left: ['0%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 bottom-0 w-8 bg-white/20 blur-md pointer-events-none"
            />
          </div>

          {/* Technical Log Snippet */}
          <div className="h-8 overflow-hidden opacity-40">
            <motion.div
              animate={{ y: [0, -40] }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="space-y-1"
            >
              {[...Array(10)].map((_, i) => (
                <p key={'log-'+i} className="text-[7px] font-mono text-emerald-500/80 uppercase tracking-tighter">
                  {`> [${new Date().toISOString().split('T')[1].split('.')[0]}] - AUTH_NODE_${Math.floor(Math.random() * 1000)}: SYNC_COMPLETE`}
                </p>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Technologic Background Overlay */}
      {fullScreen && (
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 opacity-10" 
            style={{ 
              backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', 
              backgroundSize: '32px 32px' 
            }} 
          />
          <div className="absolute top-1/4 left-10 w-px h-1/2 bg-gradient-to-b from-transparent via-brand-accent/20 to-transparent" />
          <div className="absolute top-1/4 right-10 w-px h-1/2 bg-gradient-to-b from-transparent via-brand-accent/20 to-transparent" />
        </div>
      )}
    </div>
  );
}
