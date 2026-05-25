import React from 'react';
import { cn } from '../lib/utils';

interface FiberLoadingProps {
  className?: string;
  fullScreen?: boolean;
}

export default function FiberLoading({ className, fullScreen = false }: FiberLoadingProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center font-sans select-none overflow-hidden",
      fullScreen ? "fixed inset-0 z-[10000] bg-[#05070f] w-screen h-screen" : "relative w-full py-8 bg-transparent",
      className
    )}>
      {/* Premium Ambient Pulsing Spotlights (Backdrop Layer) */}
      {fullScreen && (
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {/* Deep blur spots matching each letter's custom tech glow */}
          <div className="absolute top-1/2 left-[30%] -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#22c55e]/5 rounded-full blur-[110px] animate-pulse" />
          <div className="absolute top-1/2 left-[50%] -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#06b6d4]/5 rounded-full blur-[110px] animate-pulse [animation-delay:0.3s]" />
          <div className="absolute top-1/2 left-[70%] -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#a3e635]/5 rounded-full blur-[110px] animate-pulse [animation-delay:0.6s]" />
          
          {/* Subtle Lab Tech Grid Overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03]" 
            style={{ 
              backgroundImage: 'radial-gradient(circle, #06b6d4 1px, transparent 1px)', 
              backgroundSize: '24px 24px' 
            }} 
          />
        </div>
      )}

      {/* Core GTS Loader Stylesheet Injected Safely */}
      <style>{`
        @keyframes gtsPulse {
          0%, 100% {
            color: rgba(255, 255, 255, 0.04);
            transform: translateY(0) scale(1);
            text-shadow: none;
          }
          35% {
            color: #ffffff;
            transform: translateY(-12px) scale(1.08);
            text-shadow: 0 0 12px var(--glow-color),
                        0 0 35px var(--glow-color),
                        0 0 55px var(--glow-color);
          }
          70% {
            color: rgba(255, 255, 255, 0.04);
            transform: translateY(0) scale(1);
            text-shadow: none;
          }
        }

        @keyframes textFade {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.95; }
        }

        .gts-letter {
          display: inline-block;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.04);
          text-transform: uppercase;
          letter-spacing: 2px;
          position: relative;
          animation: gtsPulse 1.8s infinite ease-in-out;
        }

        .gts-letter:nth-child(1) {
          animation-delay: 0s;
          --glow-color: #22c55e;
        }

        .gts-letter:nth-child(2) {
          animation-delay: 0.3s;
          --glow-color: #06b6d4;
        }

        .gts-letter:nth-child(3) {
          animation-delay: 0.6s;
          --glow-color: #a3e635;
        }

        .gts-loading-text {
          color: #64748b;
          letter-spacing: 5px;
          text-transform: uppercase;
          animation: textFade 1.8s infinite ease-in-out;
        }
      `}</style>

      {/* Animated Elements Container */}
      <div className="relative flex flex-col items-center justify-center gap-6 z-10">
        <div className="flex gap-4 sm:gap-6 items-center justify-center">
          <span className="gts-letter text-5xl sm:text-7xl lg:text-8xl">G</span>
          <span className="gts-letter text-5xl sm:text-7xl lg:text-8xl">T</span>
          <span className="gts-letter text-5xl sm:text-7xl lg:text-8xl">S</span>
        </div>
        <div className="gts-loading-text text-[10px] sm:text-xs font-bold font-sans">
          Loading Services
        </div>
      </div>
    </div>
  );
}
