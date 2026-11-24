import { BrandingConfig } from "../types";
import { cn } from "./utils";

export const getCardStyle = (style?: string) => {
  // Enforce clean white card style system with robust side and bottom shadows across all panels
  return "!bg-white dark:!bg-[#2c3038] border border-slate-200/80 dark:border-white/10 !shadow-[0_8px_24px_rgba(15,23,42,0.11),6px_0_18px_-3px_rgba(15,23,42,0.10),-6px_0_18px_-3px_rgba(15,23,42,0.10)] dark:!shadow-[0_8px_24px_rgba(0,0,0,0.50),6px_0_18px_-2px_rgba(0,0,0,0.44),-6px_0_18px_-2px_rgba(0,0,0,0.44)] rounded-3xl";
};

export const getCleanErrorMessage = (error: any): string => {
  if (!error) return 'An unexpected error occurred.';
  const msg = typeof error === 'string' ? error : (error.message || String(error));
  
  if (
    msg.toLowerCase().includes('quota') || 
    msg.toLowerCase().includes('resource-exhausted') || 
    msg.toLowerCase().includes('limit exceeded')
  ) {
    return "⚠️ Database Quota Exhausted: The free daily transaction limit has been reached on this Firebase project. Writes are temporarily paused.";
  }

  try {
    const parsed = JSON.parse(msg);
    if (parsed && typeof parsed === 'object') {
      const subError = parsed.error || parsed.message;
      if (subError) {
        const subStr = String(subError);
        if (
          subStr.toLowerCase().includes('quota') || 
          subStr.toLowerCase().includes('resource-exhausted') || 
          subStr.toLowerCase().includes('limit exceeded')
        ) {
          return "⚠️ Database Quota Exhausted: The free daily transaction limit has been reached on this Firebase project. Writes are temporarily paused.";
        }
        return subStr;
      }
    }
  } catch (e) {
    // Not a JSON string
  }
  
  return msg;
};
