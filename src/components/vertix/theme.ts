// Vertix Dark Green Theme Tokens & Utility Mappings

export const THEME = {
  // Brand Dark Greens
  primary: '#1f6b4f',
  primaryDark: '#14532d',
  primaryDeep: '#0b3d2e',

  // Gradients
  brandGradient: 'bg-gradient-to-r from-[#1f6b4f] via-[#14532d] to-[#0b3d2e]',
  brandGradientHover: 'hover:from-[#18553f] hover:via-[#0f4424] hover:to-[#082e22]',
  brandGradientBr: 'bg-gradient-to-br from-[#1f6b4f] via-[#14532d] to-[#0b3d2e]',

  // Light Mode Surfaces
  light: {
    pageBg: '#eef3f1',
    cardBg: 'bg-white',
    cardBorder: 'border-slate-300',
    headerBg: 'bg-white',
    inputBg: 'bg-white',
    subtleBg: 'bg-slate-100',
    textMain: 'text-slate-950',
    textMuted: 'text-slate-700',
  },

  // Dark Mode Surfaces - High-contrast deep slate (no muddy grey)
  dark: {
    pageBg: '#0f131a',
    cardBg: 'bg-[#161b24]',
    cardBorder: 'border-[#2d3648]',
    nestedBg: 'bg-[#10141b]',
    inputBg: 'bg-[#10141b]',
    popoverBg: 'bg-[#161b24]',
    activeBg: 'bg-[#1e2736]',
    textMain: 'text-white',
    textMuted: 'text-slate-200',
  },

  // Focus rings & accents
  focusRing: 'focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500',
  accentColor: 'text-emerald-700 dark:text-emerald-300',
} as const;

export type StatCardTone =
  | 'deepGreen'
  | 'emerald'
  | 'teal'
  | 'rose'
  | 'lime'
  | 'slate'
  | 'green700'
  | 'darkGreen';

export interface ToneStyle {
  circleBg: string;
  iconBgLight: string;
  iconBgDark: string;
  iconTextLight: string;
  iconTextDark: string;
  pillBgLight: string;
  pillBgDark: string;
  pillTextLight: string;
  pillTextDark: string;
  activeRing: string;
}

export const STAT_CARD_TONES: Record<StatCardTone, ToneStyle> = {
  deepGreen: {
    circleBg: 'bg-[#0b3d2e]',
    iconBgLight: 'bg-emerald-100',
    iconBgDark: 'bg-emerald-950/80 border border-emerald-500/35',
    iconTextLight: 'text-[#064e3b]',
    iconTextDark: 'text-emerald-300',
    pillBgLight: 'bg-emerald-100 border border-emerald-300/80',
    pillBgDark: 'bg-emerald-950/90 border border-emerald-500/40',
    pillTextLight: 'text-[#064e3b]',
    pillTextDark: 'text-emerald-200',
    activeRing: 'ring-2 ring-emerald-700 dark:ring-emerald-400',
  },
  emerald: {
    circleBg: 'bg-emerald-500',
    iconBgLight: 'bg-emerald-100',
    iconBgDark: 'bg-emerald-950/80 border border-emerald-500/35',
    iconTextLight: 'text-emerald-800',
    iconTextDark: 'text-emerald-300',
    pillBgLight: 'bg-emerald-100 border border-emerald-300/80',
    pillBgDark: 'bg-emerald-950/90 border border-emerald-500/40',
    pillTextLight: 'text-emerald-900',
    pillTextDark: 'text-emerald-200',
    activeRing: 'ring-2 ring-emerald-600 dark:ring-emerald-400',
  },
  teal: {
    circleBg: 'bg-teal-500',
    iconBgLight: 'bg-teal-100',
    iconBgDark: 'bg-teal-950/80 border border-teal-500/35',
    iconTextLight: 'text-teal-800',
    iconTextDark: 'text-teal-300',
    pillBgLight: 'bg-teal-100 border border-teal-300/80',
    pillBgDark: 'bg-teal-950/90 border border-teal-500/40',
    pillTextLight: 'text-teal-900',
    pillTextDark: 'text-teal-200',
    activeRing: 'ring-2 ring-teal-600 dark:ring-teal-400',
  },
  rose: {
    circleBg: 'bg-rose-500',
    iconBgLight: 'bg-rose-100',
    iconBgDark: 'bg-rose-950/80 border border-rose-500/35',
    iconTextLight: 'text-rose-700',
    iconTextDark: 'text-rose-300',
    pillBgLight: 'bg-rose-100 border border-rose-300/80',
    pillBgDark: 'bg-rose-950/90 border border-rose-500/40',
    pillTextLight: 'text-rose-800',
    pillTextDark: 'text-rose-200',
    activeRing: 'ring-2 ring-rose-600 dark:ring-rose-400',
  },
  lime: {
    circleBg: 'bg-lime-500',
    iconBgLight: 'bg-lime-100',
    iconBgDark: 'bg-lime-950/80 border border-lime-500/35',
    iconTextLight: 'text-lime-800',
    iconTextDark: 'text-lime-300',
    pillBgLight: 'bg-lime-100 border border-lime-300/80',
    pillBgDark: 'bg-lime-950/90 border border-lime-500/40',
    pillTextLight: 'text-lime-900',
    pillTextDark: 'text-lime-200',
    activeRing: 'ring-2 ring-lime-600 dark:ring-lime-400',
  },
  slate: {
    circleBg: 'bg-slate-500',
    iconBgLight: 'bg-slate-200',
    iconBgDark: 'bg-slate-800 border border-slate-500/40',
    iconTextLight: 'text-slate-900',
    iconTextDark: 'text-slate-100',
    pillBgLight: 'bg-slate-200 border border-slate-300',
    pillBgDark: 'bg-slate-800 border border-slate-500/40',
    pillTextLight: 'text-slate-900',
    pillTextDark: 'text-slate-100',
    activeRing: 'ring-2 ring-slate-700 dark:ring-slate-300',
  },
  green700: {
    circleBg: 'bg-green-700',
    iconBgLight: 'bg-green-100',
    iconBgDark: 'bg-green-950/80 border border-green-500/35',
    iconTextLight: 'text-green-800',
    iconTextDark: 'text-green-300',
    pillBgLight: 'bg-green-100 border border-green-300/80',
    pillBgDark: 'bg-green-950/90 border border-green-500/40',
    pillTextLight: 'text-green-900',
    pillTextDark: 'text-green-200',
    activeRing: 'ring-2 ring-green-700 dark:ring-green-400',
  },
  darkGreen: {
    circleBg: 'bg-[#14532d]',
    iconBgLight: 'bg-emerald-100',
    iconBgDark: 'bg-emerald-950/80 border border-emerald-500/35',
    iconTextLight: 'text-[#064e3b]',
    iconTextDark: 'text-emerald-300',
    pillBgLight: 'bg-emerald-100 border border-emerald-300/80',
    pillBgDark: 'bg-emerald-950/90 border border-emerald-500/40',
    pillTextLight: 'text-[#064e3b]',
    pillTextDark: 'text-emerald-200',
    activeRing: 'ring-2 ring-emerald-700 dark:ring-emerald-400',
  },
};
