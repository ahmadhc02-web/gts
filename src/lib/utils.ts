import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Safely stringify an object that might have circular references
 */
export function safeStringify(obj: any, indent = 0): string {
  if (obj === undefined) return 'undefined';
  if (obj === null) return 'null';
  
  const cache = new WeakSet();
  try {
    return JSON.stringify(
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
  } catch (e) {
    return `[Stringify Error: ${e instanceof Error ? e.message : String(e)}]`;
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
