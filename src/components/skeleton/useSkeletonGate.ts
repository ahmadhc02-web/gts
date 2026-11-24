import { useState, useEffect, useRef } from 'react';

export interface UseSkeletonGateOptions {
  delay?: number;
  minShow?: number;
}

/**
 * Prevents skeleton flashing on ultra-fast loads (< delay ms) and avoids jarring
 * flicker by keeping the skeleton visible for at least `minShow` ms once shown.
 */
export function useSkeletonGate(
  isLoading: boolean,
  options: UseSkeletonGateOptions = {}
): boolean {
  const { delay = 0, minShow = 350 } = options;
  const [showSkeleton, setShowSkeleton] = useState<boolean>(() => isLoading && delay === 0);
  const shownAtRef = useRef<number | null>(isLoading && delay === 0 ? Date.now() : null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (minShowTimerRef.current) {
      clearTimeout(minShowTimerRef.current);
      minShowTimerRef.current = null;
    }

    if (isLoading) {
      if (!showSkeleton) {
        if (delay <= 0) {
          shownAtRef.current = Date.now();
          setShowSkeleton(true);
        } else {
          delayTimerRef.current = setTimeout(() => {
            shownAtRef.current = Date.now();
            setShowSkeleton(true);
          }, delay);
        }
      } else if (shownAtRef.current === null) {
        shownAtRef.current = Date.now();
      }
    } else if (showSkeleton) {
      const elapsed = shownAtRef.current !== null ? Date.now() - shownAtRef.current : minShow;
      const remaining = Math.max(0, minShow - elapsed);
      if (remaining === 0) {
        shownAtRef.current = null;
        setShowSkeleton(false);
      } else {
        minShowTimerRef.current = setTimeout(() => {
          shownAtRef.current = null;
          setShowSkeleton(false);
        }, remaining);
      }
    }

    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (minShowTimerRef.current) clearTimeout(minShowTimerRef.current);
    };
  }, [isLoading, delay, minShow, showSkeleton]);

  return delay === 0 ? (showSkeleton || isLoading) : showSkeleton;
}

export default useSkeletonGate;
