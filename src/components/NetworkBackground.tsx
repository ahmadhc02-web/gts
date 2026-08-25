import React, { useMemo } from 'react';
import { motion } from 'motion/react';

export default function NetworkBackground() {
  // Use useMemo to prevent regeneration on every re-render
  const networkData = useMemo(() => {
    const lines = Array.from({ length: 25 }).map((_, i) => {
      const startX = Math.random() * 100;
      const startY = Math.random() * 100;
      const endX = Math.random() * 100;
      const endY = Math.random() * 100;
      const duration = 3 + Math.random() * 5;
      const delay = Math.random() * 5;
      
      return { id: i, startX, startY, endX, endY, duration, delay };
    });

    const wifiNodes = Array.from({ length: 6 }).map((_, i) => ({
      id: i,
      x: Math.random() * 80 + 10,
      y: Math.random() * 80 + 10,
      delay: Math.random() * 2
    }));

    return { lines, wifiNodes };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[var(--neu-bg)] transition-colors duration-500">
      {/* Atmosphere - Pure Matte */}
      <div className="absolute inset-0 bg-transparent" />
      
      {/* Subtle Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.3) 1px, transparent 1px)',
          backgroundSize: '80px 80px' 
        }} 
      />

      <svg className="w-full h-full opacity-20 dark:opacity-25" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {networkData.lines.map((line) => (
          <React.Fragment key={line.id}>
            {/* The static path line */}
            <line 
              x1={line.startX} 
              y1={line.startY} 
              x2={line.endX} 
              y2={line.endY} 
              stroke="currentColor" 
              className="text-slate-500/20"
              strokeWidth="0.05" 
            />
            
            {/* The moving pulse */}
            <motion.circle
              r="0.25"
              fill="currentColor"
              className="text-slate-600 dark:text-slate-400"
              filter="url(#glow)"
              initial={{ offsetDistance: "0%", opacity: 0 }}
              animate={{ 
                offsetDistance: ["0%", "100%"],
                opacity: [0, 0.8, 0.8, 0]
              }}
              style={{
                offsetPath: `path('M ${line.startX} ${line.startY} L ${line.endX} ${line.endY}')`,
              }}
              transition={{
                duration: line.duration,
                repeat: Infinity,
                delay: line.delay,
                ease: "linear"
              }}
            />
          </React.Fragment>
        ))}

        {/* Signal Pulse Emitters */}
        {networkData.wifiNodes.map((node) => (
          <g key={`wifi-${node.id}`}>
            <circle cx={node.x} cy={node.y} r="0.3" fill="currentColor" className="text-slate-600 dark:text-slate-400" opacity="0.4" />
            <motion.circle
              cx={node.x}
              cy={node.y}
              r="3.5"
              stroke="currentColor"
              className="text-slate-600 dark:text-slate-400"
              strokeWidth="0.08"
              fill="none"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: [0, 0.3, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                delay: node.delay,
                ease: "easeOut"
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
