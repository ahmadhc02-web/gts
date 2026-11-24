import { useEffect, useRef } from 'react';

export function usePopupTiming(name: string, isOpen: boolean): void {
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const prevOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (!isOpen || prevOpen) return;
    if (typeof window === 'undefined' || typeof performance === 'undefined') return;

    const startMs = performance.now();
    let longFrames: number | null = null;
    let observer: PerformanceObserver | null = null;

    if (typeof PerformanceObserver !== 'undefined') {
      const supported = (PerformanceObserver as any).supportedEntryTypes as readonly string[] | undefined;
      const entryType = supported?.includes('long-animation-frame')
        ? 'long-animation-frame'
        : supported?.includes('longtask')
          ? 'longtask'
          : null;

      if (entryType) {
        longFrames = 0;
        try {
          observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.duration > 32 && longFrames !== null) {
                longFrames += 1;
              }
            }
          });
          observer.observe({ type: entryType, buffered: false } as PerformanceObserverInit);
        } catch {
          longFrames = null;
          observer = null;
        }
      }
    }

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (observer) {
          try {
            observer.disconnect();
          } catch {}
          observer = null;
        }
        const elapsed = performance.now() - startMs;
        if (longFrames !== null) {
          console.log(`[Popup] ${name} opened in ${elapsed.toFixed(1)}ms (long frames: ${longFrames})`);
        } else {
          console.log(`[Popup] ${name} opened in ${elapsed.toFixed(1)}ms`);
        }
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (observer) {
        try {
          observer.disconnect();
        } catch {}
      }
    };
  }, [name, isOpen]);
}
