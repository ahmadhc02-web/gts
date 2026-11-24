import React from 'react';
import { cn } from '../lib/utils';
import { SkFrame, SkBar, SkCircle, TabSkeleton } from './skeleton/Skeleton';

export interface PreloaderProps {
  className?: string;
  fullScreen?: boolean;
  text?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'auto';
}

export const Preloader: React.FC<PreloaderProps> = ({
  className,
  fullScreen = false,
  text: _text = "Loading",
  size = 'md'
}) => {
  if (fullScreen) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-[10000] w-screen h-[100dvh] max-h-[100dvh] h-dvh-fallback overflow-hidden bg-[#f4f7f5] dark:bg-[#1a1d21] p-3 sm:p-5 flex flex-col gap-4 select-none",
          className
        )}
      >
        <SkFrame className="h-14 flex items-center justify-between px-4 py-2 shrink-0 rounded-2xl">
          <div className="flex items-center gap-3">
            <SkCircle size="w-8 h-8" />
            <SkBar w="w-32" h="h-4" />
          </div>
          <div className="flex items-center gap-2">
            <SkBar w="w-20" h="h-7" rounded="rounded-xl" />
            <SkCircle size="w-8 h-8" />
          </div>
        </SkFrame>
        <div className="flex-1 overflow-hidden">
          <TabSkeleton variant="dashboard" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full select-none",
        size === 'xs' || size === 'sm' ? 'py-2' : 'py-4',
        className
      )}
    >
      <TabSkeleton variant="default" />
    </div>
  );
};

export default Preloader;
