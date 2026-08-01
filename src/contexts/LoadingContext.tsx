import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export interface LoadingOperation {
  id: string;
  label: string;
  startTime: number;
}

export interface LoadingContextType {
  isLoading: boolean;
  progress: number;
  currentLabel: string;
  operationsCount: number;
  startLoading: (label?: string) => string;
  stopLoading: (id: string) => void;
  wrapLoading: <T>(promiseOrFn: Promise<T> | (() => Promise<T>), label?: string) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

// Global event name for non-React callers
const GLOBAL_LOADING_START_EVENT = 'gts-global-loading-start';
const GLOBAL_LOADING_STOP_EVENT = 'gts-global-loading-stop';

export const globalLoading = {
  start: (label?: string): string => {
    const id = 'op_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GLOBAL_LOADING_START_EVENT, { detail: { id, label: label || 'Processing data...' } }));
    }
    return id;
  },
  stop: (id: string) => {
    if (typeof window !== 'undefined' && id) {
      window.dispatchEvent(new CustomEvent(GLOBAL_LOADING_STOP_EVENT, { detail: { id } }));
    }
  },
  wrap: async <T,>(promiseOrFn: Promise<T> | (() => Promise<T>), label?: string): Promise<T> => {
    const id = globalLoading.start(label);
    try {
      const promise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
      return await promise;
    } finally {
      globalLoading.stop(id);
    }
  }
};

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [operations, setOperations] = useState<LoadingOperation[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = useCallback((label?: string): string => {
    const id = 'op_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const opLabel = label || 'Processing data...';
    setOperations(prev => [...prev, { id, label: opLabel, startTime: Date.now() }]);
    return id;
  }, []);

  const stopLoading = useCallback((id: string) => {
    if (!id) return;
    setOperations(prev => prev.filter(op => op.id !== id));
  }, []);

  const wrapLoading = useCallback(async <T,>(promiseOrFn: Promise<T> | (() => Promise<T>), label?: string): Promise<T> => {
    const id = startLoading(label);
    try {
      const promise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
      return await promise;
    } finally {
      stopLoading(id);
    }
  }, [startLoading, stopLoading]);

  // Listen for global non-React events
  useEffect(() => {
    const handleGlobalStart = (e: Event) => {
      const custom = e as CustomEvent<{ id: string; label: string }>;
      if (custom.detail) {
        setOperations(prev => [...prev, { id: custom.detail.id, label: custom.detail.label, startTime: Date.now() }]);
      }
    };

    const handleGlobalStop = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>;
      if (custom.detail?.id) {
        setOperations(prev => prev.filter(op => op.id !== custom.detail.id));
      }
    };

    window.addEventListener(GLOBAL_LOADING_START_EVENT, handleGlobalStart);
    window.addEventListener(GLOBAL_LOADING_STOP_EVENT, handleGlobalStop);

    return () => {
      window.removeEventListener(GLOBAL_LOADING_START_EVENT, handleGlobalStart);
      window.removeEventListener(GLOBAL_LOADING_STOP_EVENT, handleGlobalStop);
    };
  }, []);

  const hasOperations = operations.length > 0;
  const currentLabel = operations.length > 0 ? operations[operations.length - 1].label : 'Complete';

  // Manage progress animation loop
  useEffect(() => {
    if (hasOperations) {
      if (finishTimeoutRef.current) {
        clearTimeout(finishTimeoutRef.current);
        finishTimeoutRef.current = null;
      }

      setIsFinishing(false);
      setVisible(true);

      // Start progress from 10% if it was 0
      setProgress(prev => (prev === 0 ? 10 : prev));

      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setProgress(prev => {
            if (prev < 70) {
              return Math.min(70, prev + Math.random() * 8 + 4);
            } else if (prev < 90) {
              return Math.min(90, prev + Math.random() * 3 + 1);
            } else if (prev < 97) {
              return Math.min(97, prev + Math.random() * 0.8 + 0.2);
            }
            return prev;
          });
        }, 35);
      }
    } else {
      // Operations ended -> jump to 100% and finish
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (visible && !isFinishing) {
        setIsFinishing(true);
        setProgress(100);

        finishTimeoutRef.current = setTimeout(() => {
          setVisible(false);
          setIsFinishing(false);
          setProgress(0);
        }, 500);
      }
    }

    return () => {
      // cleanup on unmount
    };
  }, [hasOperations, visible, isFinishing]);

  const value = {
    isLoading: visible || hasOperations,
    progress: Math.min(100, Math.round(progress)),
    currentLabel: visible && !hasOperations ? 'Operation completed' : currentLabel,
    operationsCount: operations.length,
    startLoading,
    stopLoading,
    wrapLoading,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    // Return global fallback if called outside provider
    return {
      isLoading: false,
      progress: 0,
      currentLabel: '',
      operationsCount: 0,
      startLoading: globalLoading.start,
      stopLoading: globalLoading.stop,
      wrapLoading: globalLoading.wrap,
    };
  }
  return context;
};
