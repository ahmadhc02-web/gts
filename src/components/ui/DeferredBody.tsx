import React, { useEffect, useState, useRef } from 'react';

interface DeferredBodyProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  frames?: number;
  mode?: 'frames' | 'idle' | 'visible';
  rootMargin?: string;
  minHeight?: number | string;
  className?: string;
}

export const DeferredBody: React.FC<DeferredBodyProps> = ({
  children,
  fallback,
  frames = 2,
  mode = 'frames',
  rootMargin = '200px',
  minHeight,
  className,
}) => {
  const [ready, setReady] = useState(false);
  const sentinelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let timeoutId: any = null;
    let idleId: any = null;
    let observer: IntersectionObserver | null = null;

    if (mode === 'frames') {
      let remaining = Math.max(1, frames);
      const step = () => {
        if (cancelled) return;
        remaining -= 1;
        if (remaining <= 0) {
          setReady(true);
        } else {
          rafId = requestAnimationFrame(step);
        }
      };
      rafId = requestAnimationFrame(step);
    } else if (mode === 'idle') {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleId = (window as any).requestIdleCallback(() => {
          if (!cancelled) setReady(true);
        }, { timeout: 600 });
      } else {
        timeoutId = setTimeout(() => {
          if (!cancelled) setReady(true);
        }, 120);
      }
    } else if (mode === 'visible') {
      const el = sentinelRef.current;
      if (el && 'IntersectionObserver' in window) {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                if (!cancelled) {
                  setReady(true);
                  observer?.disconnect();
                }
              }
            });
          },
          { rootMargin }
        );
        observer.observe(el);
      } else {
        timeoutId = setTimeout(() => {
          if (!cancelled) setReady(true);
        }, 100);
      }
    }

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (observer) observer.disconnect();
    };
  }, [frames, mode, rootMargin]);

  if (mode === 'frames' || mode === 'idle') {
    if (ready) return <>{children}</>;
    if (!minHeight && !className) return <>{fallback}</>;
    return (
      <div className={className} style={minHeight !== undefined ? { minHeight } : undefined}>
        {fallback}
      </div>
    );
  }

  // mode === 'visible'
  if (ready) return <>{children}</>;
  return (
    <>
      <span aria-hidden="true" className="block h-px w-full" ref={sentinelRef} />
      {minHeight !== undefined || className ? (
        <div className={className} style={minHeight !== undefined ? { minHeight } : undefined}>
          {fallback}
        </div>
      ) : (
        <>{fallback}</>
      )}
    </>
  );
};

export default DeferredBody;
