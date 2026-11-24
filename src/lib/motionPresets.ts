import type { Transition } from 'motion/react';

export const overlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: 'easeOut' as const } satisfies Transition,
};

export const dialogMotion = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 4 },
  transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const } satisfies Transition,
};

export const dropdownMotion = {
  initial: { opacity: 0, scale: 0.98, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 4 },
  transition: { duration: 0.12, ease: [0.16, 1, 0.3, 1] as const } satisfies Transition,
};
