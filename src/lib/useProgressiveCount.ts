import { useEffect, useRef, useState } from 'react';

export interface UseProgressiveCountOptions {
  initial?: number;
  chunk?: number;
  resetKey?: unknown;
  stepMode?: 'idle' | 'frame';
}

/**
 * Progressively increases the number of mounted rows in idle or frame chunks
 * to avoid long main-thread tasks when rendering large tables.
 */
export function useProgressiveCount(
  total: number,
  { initial = 20, chunk = 40, resetKey, stepMode = 'idle' }: UseProgressiveCountOptions = {}
): number {
  const safeTotal = Math.max(0, total);
  const safeInitial = Math.max(0, initial);
  const safeChunk = Math.max(1, chunk);
  const initialCount = Math.min(safeTotal, safeInitial);

  const [count, setCount] = useState<number>(initialCount);
  const countRef = useRef<number>(initialCount);
  const prevResetKeyRef = useRef<unknown>(resetKey);
  const mountedRef = useRef<boolean>(false);

  // Immediately reset to initialCount when resetKey changes so excess rows
  // are never rendered for even a single frame after search/filter/sort/page changes.
  if (!Object.is(prevResetKeyRef.current, resetKey)) {
    prevResetKeyRef.current = resetKey;
    countRef.current = initialCount;
    if (count !== initialCount) {
      setCount(initialCount);
    }
  } else if (countRef.current > safeTotal) {
    countRef.current = safeTotal;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let handle: number | ReturnType<typeof setTimeout> | null = null;
    let handleType: 'idle' | 'frame' | 'timeout' | null = null;

    const cancelScheduled = () => {
      if (handle === null) return;
      if (
        handleType === 'frame' &&
        typeof window !== 'undefined' &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(handle as number);
      } else if (
        handleType === 'idle' &&
        typeof window !== 'undefined' &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(handle as number);
      } else {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
      }
      handle = null;
      handleType = null;
    };

    const scheduleNext = () => {
      if (!active || !mountedRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (countRef.current >= safeTotal) return;
      if (handle !== null) return;

      if (stepMode === 'frame') {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          handleType = 'frame';
          handle = window.requestAnimationFrame(step);
        } else {
          handleType = 'timeout';
          handle = setTimeout(step, 16);
        }
      } else if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        handleType = 'idle';
        handle = window.requestIdleCallback(step, { timeout: 200 });
      } else {
        handleType = 'timeout';
        handle = setTimeout(step, 50);
      }
    };

    const step = () => {
      handle = null;
      handleType = null;
      if (!active || !mountedRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      const current = countRef.current;
      if (current >= safeTotal) return;

      const next = Math.min(current + safeChunk, safeTotal);
      countRef.current = next;
      setCount(next);

      if (next < safeTotal) {
        scheduleNext();
      }
    };

    const handleVisibilityChange = () => {
      if (!active || !mountedRef.current) return;
      if (document.hidden) {
        cancelScheduled();
      } else if (countRef.current < safeTotal) {
        scheduleNext();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    if (countRef.current < safeTotal && (typeof document === 'undefined' || !document.hidden)) {
      scheduleNext();
    }

    return () => {
      active = false;
      cancelScheduled();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [safeTotal, initialCount, safeChunk, resetKey, stepMode]);

  return Math.min(count, safeTotal);
}

export default useProgressiveCount;
