import { BrandingConfig } from "../types";
import { cn } from "./utils";

export const getCardStyle = (style?: string) => {
  // Enforce global Neumorphic style system for all panels
  return "!bg-[var(--neu-surface)] !border-[var(--neu-border)] !shadow-[var(--neu-shadow-raised)] rounded-3xl";
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
