import React from 'react';
import { cn } from '../lib/utils';

export interface PreloaderProps {
  className?: string;
  fullScreen?: boolean;
  text?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'auto';
}

export const Preloader: React.FC<PreloaderProps> = ({
  className,
  fullScreen = false,
  text = "Loading",
  size = 'md'
}) => {
  return (
    <div
      className={cn(
        "preloader-container select-none flex flex-col items-center justify-center",
        fullScreen
          ? "fixed inset-0 z-[10000] w-screen h-screen bg-gradient-to-br from-[#f2f4f8] to-[#e2e6f0] dark:from-[#353840] dark:via-[#2b2d33] dark:to-[#222428]"
          : "relative w-full py-8 bg-transparent",
        className
      )}
    >
      <main
        className={cn(
          "m-auto flex flex-col items-center justify-center",
          size === 'xs' ? 'text-[9px]' :
          size === 'sm' ? 'text-[11px]' :
          size === 'md' ? 'text-[14px]' :
          size === 'lg' ? 'text-[18px]' :
          'text-[calc(14px+(24-14)*(100vw-320px)/(2560-320))]'
        )}
      >
        <div className="preloader" id="neu-preloader-core">
          <div className="preloader__square"></div>
          <div className="preloader__square"></div>
          <div className="preloader__square"></div>
          <div className="preloader__square"></div>
        </div>
        <div className="status" id="neu-preloader-status">
          {text}
          <span className="status__dot">.</span>
          <span className="status__dot">.</span>
          <span className="status__dot">.</span>
        </div>
      </main>
    </div>
  );
};

export default Preloader;
