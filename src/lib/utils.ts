import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Safely stringify an object that might have circular references
 */
export function safeStringify(obj: any, indent = 0): string {
  const cache = new Set();
  const result = JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular]';
        }
        cache.add(value);
      }
      return value;
    },
    indent
  );
  cache.clear();
  return result;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
