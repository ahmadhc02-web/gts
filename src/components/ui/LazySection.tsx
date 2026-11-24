import React from 'react';
import DeferredBody from './DeferredBody';

interface LazySectionProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  minHeight?: number | string;
  mode?: 'frames' | 'idle' | 'visible';
  frames?: number;
  rootMargin?: string;
  className?: string;
}

export const LazySection: React.FC<LazySectionProps> = ({
  children,
  fallback,
  minHeight,
  mode = 'visible',
  frames,
  rootMargin = '200px',
  className,
}) => {
  return (
    <DeferredBody
      fallback={fallback}
      mode={mode}
      frames={frames}
      minHeight={minHeight}
      rootMargin={rootMargin}
      className={className}
    >
      {children}
    </DeferredBody>
  );
};

export default LazySection;
