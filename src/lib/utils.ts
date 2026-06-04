import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Complaint } from '../types';

/**
 * Filters and maps scheduled complaints according to scheduling rules:
 * - If scheduledAt is in the future (> 12 hours remaining), hide completely.
 * - If scheduledAt is within 12 hours (or in the past), force status to 'pending' as active.
 */
export function processScheduledComplaints(complaintsList: Complaint[]): Complaint[] {
  const currentTime = Date.now();
  return complaintsList
    .filter(c => {
      if (c.scheduledAt) {
        const hoursRemaining = (c.scheduledAt - currentTime) / (1000 * 60 * 60);
        // If scheduled date is in future and more than 12 hours away, hide completely
        return hoursRemaining <= 12;
      }
      return true;
    })
    .map(c => {
      if (c.scheduledAt) {
        const hoursRemaining = (c.scheduledAt - currentTime) / (1000 * 60 * 60);
        if (hoursRemaining <= 12) {
          return {
            ...c,
            status: 'pending' // Force status to 'pending' once within the 12-hour warning window
          };
        }
      }
      return c;
    });
}

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
