'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { FLAG_NAVY, MOTION_DURATION, MOTION_EASE, SECTION_Y } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

type EmptyLineStateProps = {
  children: ReactNode;
  className?: string;
};

/** Empty states draw a single navy line, then show the text. */
export function EmptyLineState({ children, className }: EmptyLineStateProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className={cn('text-center', className)}>
      <motion.span
        aria-hidden
        className="mx-auto mb-4 block h-px w-14"
        style={{ backgroundColor: FLAG_NAVY, transformOrigin: 'center' }}
        initial={reducedMotion ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, ease: MOTION_EASE }}
      />
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: SECTION_Y }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: MOTION_DURATION, delay: reducedMotion ? 0 : 0.18, ease: MOTION_EASE }}
      >
        {children}
      </motion.div>
    </div>
  );
}
