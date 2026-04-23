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
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#020617]">
      {/* Deep Space Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-black" />
      
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-5" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.2) 1px, transparent 1px)',
          backgroundSize: '100px 100px' 
        }} 
      />

      <svg className="w-full h-full opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
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
              className="text-blue-500/10"
              strokeWidth="0.05" 
            />
            
            {/* The moving pulse */}
            <motion.circle
              r="0.3"
              fill="#3b82f6"
              filter="url(#glow)"
              initial={{ offsetDistance: "0%", opacity: 0 }}
              animate={{ 
                offsetDistance: ["0%", "100%"],
                opacity: [0, 1, 1, 0]
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

        {/* WiFi / Signal Pulse Emitters */}
        {networkData.wifiNodes.map((node) => (
          <g key={`wifi-${node.id}`}>
            <circle cx={node.x} cy={node.y} r="0.4" fill="#3b82f6" opacity="0.5" />
            <motion.circle
              cx={node.x}
              cy={node.y}
              r="4"
              stroke="#3b82f6"
              strokeWidth="0.1"
              fill="none"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: [0, 0.4, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                delay: node.delay,
                ease: "easeOut"
              }}
            />
            <motion.circle
              cx={node.x}
              cy={node.y}
              r="8"
              stroke="#3b82f6"
              strokeWidth="0.05"
              fill="none"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: [0, 0.2, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                delay: node.delay + 1,
                ease: "easeOut"
              }}
            />
          </g>
        ))}
      </svg>

      {/* Decorative Blur Blobs */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>
    </div>
  );
}
