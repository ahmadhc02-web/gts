import { BrandingConfig } from "../types";
import { cn } from "./utils";

export const getCardStyle = (style: BrandingConfig['cardStyle']) => {
  switch (style) {
    case 'flat':
      return "bg-white dark:bg-slate-900 border-0 shadow-none";
    case 'bordered':
      return "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm";
    case 'elevated':
      return "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl";
    case 'glass':
      return "glass";
    default:
      return "business-card";
  }
};
