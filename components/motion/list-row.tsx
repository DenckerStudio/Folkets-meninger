'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { MOTION_EASE } from '@/lib/motion/tokens';

type MotionListProps = {
  children: ReactNode;
  className?: string;
};

export function MotionList({ children, className }: MotionListProps) {
  return (
    <ul className={className}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </ul>
  );
}

type MotionListRowProps = {
  id: string;
  children: ReactNode;
};

/** Insert or remove a row with a short height ease, not a jump. */
export function MotionListRow({ id, children }: MotionListRowProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <motion.li
      key={id}
      layout
      initial={reducedMotion ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
      transition={{ duration: 0.32, ease: MOTION_EASE }}
      className="overflow-hidden"
    >
      {children}
    </motion.li>
  );
}
