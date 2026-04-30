import React, { useEffect } from 'react';
import { motion } from 'motion/react';

interface WelcomeOverlayProps {
  username: string;
  onComplete: () => void;
}

export default function WelcomeOverlay({ username, onComplete }: WelcomeOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl"
    >
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 100,
              damping: 15,
              delay: 0.2 
            }}
          >
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter uppercase italic">
              Welcome <span className="text-emerald-500">Back</span>
            </h1>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex items-center justify-center gap-4"
          >
            <div className="h-[2px] w-12 bg-emerald-500/50" />
            <p className="text-xl md:text-2xl font-bold text-slate-400 uppercase tracking-[0.3em]">
              {username}
            </p>
            <div className="h-[2px] w-12 bg-emerald-500/50" />
          </motion.div>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.8, duration: 1, ease: "circOut" }}
            className="h-1 w-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
          />
        </div>

        {/* Decorative elements */}
        <motion.div 
          animate={{ 
            rotate: 360,
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-emerald-500/10 rounded-full -z-10"
        />
        <motion.div 
          animate={{ 
            rotate: -360,
            scale: [1, 1.5, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-emerald-500/5 rounded-full -z-10"
        />
      </motion.div>
  );
}
