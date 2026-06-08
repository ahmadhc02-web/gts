import { BrandingConfig } from "../types";
import { cn } from "./utils";

export const getCardStyle = (style: BrandingConfig['cardStyle']) => {
  switch (style) {
    case 'flat':
      return "bg-white dark:bg-slate-900 border-0 shadow-none";
    case 'bordered':
      return "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md shadow-black/5 dark:shadow-black/30";
    case 'elevated':
      return "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl shadow-black/15 dark:shadow-black/60";
    case 'glass':
      return "glass";
    default:
      return "business-card";
  }
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
