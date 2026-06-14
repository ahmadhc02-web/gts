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
      fullScreen 
        ? "fixed inset-0 z-[10000] bg-slate-950 w-screen h-screen" 
        : "relative w-full py-16 bg-transparent",
      className
    )}>
      {/* Embedded 2x Scale Wifi-Loader Custom Styles */}
      <style>{`
        #wifi-loader {
          --background: #0ea5e9;
          --front-color: #38bdf8;
          --back-color: rgba(226, 232, 240, 0.08);
          --text-color: #94a3b8;
          
          /* 2x original size: 64px * 2 = 128px */
          width: 140px;
          height: 140px;
          border-radius: 50px;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        #wifi-loader svg {
          position: absolute;
          display: flex;
          justify-content: center;
          align-items: center;
          filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.45));
        }

        #wifi-loader svg circle {
          position: absolute;
          fill: none;
          stroke-width: 5px; /* Thicker for 2x scale crispness */
          stroke-linecap: round;
          stroke-linejoin: round;
          transform: rotate(-100deg);
          transform-origin: center;
        }

        #wifi-loader svg circle.back {
          stroke: var(--back-color);
        }

        #wifi-loader svg circle.front {
          stroke: var(--front-color);
        }

        /* Outer Circle: 2x Scale from original 86px -> 172px */
        #wifi-loader svg.circle-outer {
          height: 172px;
          width: 172px;
        }

        #wifi-loader svg.circle-outer circle {
          stroke-dasharray: 62.75 188.25;
        }

        #wifi-loader svg.circle-outer circle.back {
          animation: circle-outer135 1.8s ease infinite 0.3s;
        }

        #wifi-loader svg.circle-outer circle.front {
          animation: circle-outer135 1.8s ease infinite 0.15s;
        }

        /* Middle Circle: 2x Scale from original 60px -> 120px */
        #wifi-loader svg.circle-middle {
          height: 120px;
          width: 120px;
        }

        #wifi-loader svg.circle-middle circle {
          stroke-dasharray: 42.5 127.5;
        }

        #wifi-loader svg.circle-middle circle.back {
          animation: circle-middle6123 1.8s ease infinite 0.25s;
        }

        #wifi-loader svg.circle-middle circle.front {
          animation: circle-middle6123 1.8s ease infinite 0.1s;
        }

        /* Inner Circle: 2x Scale from original 34px -> 68px */
        #wifi-loader svg.circle-inner {
          height: 68px;
          width: 68px;
        }

        #wifi-loader svg.circle-inner circle {
          stroke-dasharray: 22 66;
        }

        #wifi-loader svg.circle-inner circle.back {
          animation: circle-inner162 1.8s ease infinite 0.2s;
        }

        #wifi-loader svg.circle-inner circle.front {
          animation: circle-inner162 1.8s ease infinite 0.05s;
        }

        #wifi-loader .text {
          position: absolute;
          bottom: -54px;
          display: flex;
          justify-content: center;
          align-items: center;
          text-transform: uppercase;
          font-weight: 800;
          font-family: inherit;
          font-size: 14px;
          letter-spacing: 4px;
          padding-left: 4px;
        }

        #wifi-loader .text::before,
        #wifi-loader .text::after {
          content: attr(data-text);
        }

        #wifi-loader .text::before {
          color: var(--text-color);
          opacity: 0.3;
        }

        #wifi-loader .text::after {
          color: #ffffff;
          text-shadow: 0 0 10px rgba(56, 189, 248, 0.6);
          animation: text-animation76 3.6s ease infinite;
          position: absolute;
          left: 4px;
        }

        @keyframes circle-outer135 {
          0% { stroke-dashoffset: 25; }
          25% { stroke-dashoffset: 0; }
          65% { stroke-dashoffset: 301; }
          80% { stroke-dashoffset: 276; }
          100% { stroke-dashoffset: 276; }
        }

        @keyframes circle-middle6123 {
          0% { stroke-dashoffset: 17; }
          25% { stroke-dashoffset: 0; }
          65% { stroke-dashoffset: 204; }
          80% { stroke-dashoffset: 187; }
          100% { stroke-dashoffset: 187; }
        }

        @keyframes circle-inner162 {
          0% { stroke-dashoffset: 9; }
          25% { stroke-dashoffset: 0; }
          65% { stroke-dashoffset: 106; }
          80% { stroke-dashoffset: 97; }
          100% { stroke-dashoffset: 97; }
        }

        @keyframes text-animation76 {
          0% { clip-path: inset(0 100% 0 0); }
          50% { clip-path: inset(0); }
          100% { clip-path: inset(0 0 0 100%); }
        }
      `}</style>

      {/* Luxury Ambience Spotlights (Backdrop layer for premium feel on full screen) */}
      {fullScreen && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden bg-slate-950 z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0284c7]/[0.05] rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '6s' }} />
          <div 
            className="absolute inset-0 opacity-[0.02]" 
            style={{ 
              backgroundImage: 'radial-gradient(circle, #0ea5e9 1px, transparent 1px)', 
              backgroundSize: '24px 24px' 
            }} 
          />
        </div>
      )}

      {/* 2x Scaled Wifi Loader Container */}
      <div className={cn(
        "relative flex flex-col items-center justify-center z-10 scale-110",
        fullScreen ? "mt-[-40px]" : ""
      )}>
        <div id="wifi-loader">
          <svg viewBox="0 0 86 86" className="circle-outer">
            <circle r="40" cy="43" cx="43" className="back"></circle>
            <circle r="40" cy="43" cx="43" className="front"></circle>
          </svg>
          <svg viewBox="0 0 60 60" className="circle-middle">
            <circle r="27" cy="30" cx="30" className="back"></circle>
            <circle r="27" cy="30" cx="30" className="front"></circle>
          </svg>
          <svg viewBox="0 0 34 34" className="circle-inner">
            <circle r="14" cy="17" cx="17" className="back"></circle>
            <circle r="14" cy="17" cx="17" className="front"></circle>
          </svg>
          <div data-text="searching" className="text"></div>
        </div>
      </div>
    </div>
  );
}
