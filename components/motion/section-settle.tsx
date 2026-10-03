'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { MOTION_DURATION, MOTION_EASE, SECTION_OPACITY_FROM, SECTION_Y } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

type SectionSettleProps = {
  children: ReactNode;
  className?: string;
};

/** Page sections fade and rise a few pixels on first view. Same timing everywhere. */
export function SectionSettle({ children, className }: SectionSettleProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={reducedMotion ? false : { opacity: SECTION_OPACITY_FROM, y: SECTION_Y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: MOTION_DURATION, ease: MOTION_EASE }}
    >
      {children}
    </motion.div>
  );
}
