import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface FiberLoadingProps {
  className?: string;
  fullScreen?: boolean;
}

export default function FiberLoading({ className, fullScreen = false }: FiberLoadingProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center",
      fullScreen && "fixed inset-0 z-[10000] bg-slate-950 overflow-hidden select-none",
      className
    )}>
      {/* Cinematic Dark Grid & Laser Alignment Backdrop */}
      {fullScreen && (
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {/* Neon Radial Depths (Pre-fusion glow) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-cyan-500/10 via-brand-accent/5 to-purple-500/10 rounded-full blur-[140px] opacity-65" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-cyan-500/10 rounded-full blur-[90px] opacity-40 animate-pulse" />
          
          {/* Subtle Lab Matrix Grid */}
          <div 
            className="absolute inset-0 opacity-[0.08]" 
            style={{ 
              backgroundImage: 'radial-gradient(circle, #22d3ee 1px, transparent 1px)', 
              backgroundSize: '24px 24px' 
            }} 
          />

          {/* Sweeping Laser Scan Line (Alignment Indicator) */}
          <motion.div
            animate={{ y: ['-100%', '200%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent blur-[1px]"
          />
        </div>
      )}

      {/* Fiber Splicing Machine Visualizer */}
      <div className="relative w-full max-w-lg h-80 flex flex-col items-center justify-center">
        
        {/* Lab/Tech Clutches/Chucks Holding Fibers */}
        <div className="absolute inset-x-0 flex justify-between px-16 pointer-events-none opacity-40">
          {/* Left Fiber Holder */}
          <div className="w-14 h-20 border-r-4 border-cyan-500 bg-slate-900/80 rounded-l-md flex flex-col justify-between p-1.5 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
            <div className="w-full h-1 bg-cyan-500/30 rounded" />
            <div className="w-full h-2 bg-slate-800 border border-slate-700 rounded" />
            <div className="w-full h-1 bg-cyan-500/30 rounded" />
          </div>
          {/* Right Fiber Holder */}
          <div className="w-14 h-20 border-l-4 border-indigo-500 bg-slate-900/80 rounded-r-md flex flex-col justify-between p-1.5 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <div className="w-full h-1 bg-indigo-500/30 rounded" />
            <div className="w-full h-2 bg-slate-800 border border-slate-700 rounded" />
            <div className="w-full h-1 bg-indigo-500/30 rounded" />
          </div>
        </div>

        {/* Dynamic Plasma Spark Arc Nodes (Splicer Electrodes Top & Bottom) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none flex flex-col items-center justify-between py-10 z-10">
          {/* Top Electrode */}
          <div className="flex flex-col items-center">
            <div className="w-4 h-14 bg-gradient-to-b from-slate-800 to-slate-400 rounded-b shadow-[0_-5px_15px_rgba(255,255,255,0.1)]" />
            <div className="w-1.5 h-3 bg-amber-400 rounded-b-full shadow-[0_0_10px_#fbbf24] animate-pulse" />
          </div>
          
          {/* Bottom Electrode */}
          <div className="flex flex-col items-center">
            <div className="w-1.5 h-3 bg-amber-400 rounded-t-full shadow-[0_0_10px_#fbbf24] animate-pulse" />
            <div className="w-4 h-14 bg-gradient-to-t from-slate-800 to-slate-400 rounded-t shadow-[0_5px_15px_rgba(255,255,255,0.1)]" />
          </div>
        </div>

        {/* THE FUSION STAGE */}
        <div className="relative w-[360px] h-[160px] flex items-center justify-center">
          
          {/* Cyber Aligning Brackets (Horizontal Crosshairs) */}
          <div className="absolute inset-0 flex items-center justify-between border-l border-r border-cyan-500/10 pointer-events-none">
            <div className="w-6 h-6 border-t border-l border-cyan-500/30 -ml-2" />
            <div className="w-6 h-6 border-b border-r border-indigo-500/30 -mr-2" />
          </div>

          {/* LEFT OPTICAL FIBER (Reaches towards center with laser core) */}
          <motion.div
            animate={{ 
              x: [
                -50,  // Far left (Preparation)
                -2,   // Close gap alignment
                1,    // Melt / Spliced Contact
                1,    // Wait fused
                -50   // Repreparation loop
              ] 
            }}
            transition={{
              duration: 5.5,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.22, 0.32, 0.9, 1]
            }}
            className="absolute left-0 w-1/2 h-10 flex items-center justify-end pr-[2px]"
          >
            {/* Cladding / Outer Glass Sleeve */}
            <div className="relative w-40 h-5 bg-gradient-to-b from-white/20 via-white/5 to-white/25 rounded-l border-t border-b border-white/20 backdrop-blur-[1px] shadow-inner">
              {/* Inner Glowing Silica Core */}
              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-cyan-400 shadow-[0_0_12px_#22d3ee,0_0_4px_#38bdf8]" />
              {/* Inner Laser Alignment Indicator */}
              <div className="absolute top-0 right-1 w-2 h-full bg-cyan-400/30 animate-pulse" />
            </div>
          </motion.div>

          {/* RIGHT OPTICAL FIBER (Reaches from right with matching core) */}
          <motion.div
            animate={{ 
              x: [
                50,   // Far right
                2,    // Close alignment
                -1,   // Melt / Spliced Contact
                -1,   // Wait fused
                50    // Loop reset
              ] 
            }}
            transition={{
              duration: 5.5,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.22, 0.32, 0.9, 1]
            }}
            className="absolute right-0 w-1/2 h-10 flex items-center justify-start pl-[2px]"
          >
            {/* Cladding / Outer Glass Sleeve */}
            <div className="relative w-40 h-5 bg-gradient-to-b from-white/20 via-white/5 to-white/25 rounded-r border-t border-b border-white/20 backdrop-blur-[1px] shadow-inner">
              {/* Inner Glowing Silica Core */}
              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-indigo-400 shadow-[0_0_12px_#818cf8,0_0_4px_#6366f1]" />
              {/* Inner Laser Alignment Indicator */}
              <div className="absolute top-0 left-1 w-2 h-full bg-indigo-400/30 animate-pulse" />
            </div>
          </motion.div>

          {/* HIGH TEMPERATURE PLASMA ELECTRIC ARC (FUSION ARC TRIGGER) */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [0, 0, 5, 1.2, 0, 0],
              opacity: [0, 0, 1, 0.8, 0, 0],
            }}
            transition={{
              duration: 5.5,
              repeat: Infinity,
              times: [0, 0.28, 0.33, 0.44, 0.52, 1],
              ease: "easeOut"
            }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
          >
            {/* White-Hot Core Plasma Arc */}
            <div className="w-10 h-10 rounded-full bg-white shadow-[0_0_50px_#fff,0_0_30px_#22d3ee,0_0_15px_#22d3ee] flex items-center justify-center">
              {/* Electric Discharge Sparks */}
              <div className="w-full h-[3px] bg-cyan-300 animate-ping rounded-full" />
              <div className="absolute w-[3px] h-full bg-cyan-300 animate-ping rounded-full" />
            </div>
          </motion.div>

          {/* EXPLODING ENERGY WAVE (Shockwave when fibers fuse) */}
          <motion.div
            initial={{ scale: 0.1, opacity: 0 }}
            animate={{
              scale: [0.1, 0.1, 1.8, 0],
              opacity: [0, 0, 0.7, 0],
            }}
            transition={{
              duration: 5.5,
              repeat: Infinity,
              times: [0, 0.31, 0.46, 0.6],
              ease: "easeOut"
            }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-cyan-400 rounded-full blur-[1px]"
          />

          {/* HIGH-SPEED PHOTON DATA FLOWS (Occurs instantly after splicing succeeds) */}
          <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
            {[...Array(6)].map((_, idx) => (
              <motion.div
                key={'photon-' + idx}
                initial={{ x: '10%', opacity: 0, scale: 0.8 }}
                animate={{
                  x: ['10%', '10%', '90%', '90%'],
                  opacity: [0, 0, 1, 0],
                  scale: [0.8, 0.8, 1.2, 0.8]
                }}
                transition={{
                  duration: 5.5,
                  repeat: Infinity,
                  times: [0, 0.35, 0.85, 1],
                  delay: idx * 0.08,
                  ease: "easeInOut"
                }}
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_12px_rgba(34,211,238,1)] border border-cyan-400"
              />
            ))}
          </div>

          {/* SPLICER CALIBRATION OVERLAY GRID DATA */}
          <div className="absolute inset-x-0 bottom-2 flex justify-between px-3 font-mono text-[9px] text-cyan-400/40 pointer-events-none select-none">
            <div className="flex flex-col gap-0.5">
              <span>AXIS X: ALIGNED</span>
              <span>LOSS: 0.01 dB</span>
            </div>
            <div className="flex flex-col gap-0.5 items-end">
              <span>ARC: 15.2 mA</span>
              <span>SPLICING...</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
