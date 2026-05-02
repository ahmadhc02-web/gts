import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility to merge tailwind classes safely.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely stringifies an object, handling circular references and other serialization errors.
 * @param obj The object to stringify
 * @param indent Optional indentation
 * @returns A string representation of the object or a fallback error string
 */
export function safeStringify(obj: any, indent?: number): string {
  try {
    const cache = new Set();
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
  } catch (err) {
    return `[Serialization Error: ${err instanceof Error ? err.message : String(err)}]`;
  }
}
