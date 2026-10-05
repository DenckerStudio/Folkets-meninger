'use client';

import { motion } from 'motion/react';
import { MOTION_EASE } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

type TabUnderlineProps = {
  layoutId: string;
  className?: string;
};

/** Thin navy underline that slides to the active tab. */
export function TabUnderline({ layoutId, className }: TabUnderlineProps) {
  return (
    <motion.span
      layoutId={layoutId}
      className={cn('absolute inset-x-2 -bottom-0.5 h-0.5 bg-[#00205b]', className)}
      transition={{ duration: 0.32, ease: MOTION_EASE }}
      aria-hidden
    />
  );
}
