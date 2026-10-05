'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { FLAG_RED, MOTION_EASE } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

type PartyMarkProps = {
  children: ReactNode;
  className?: string;
  label: string;
};

/** Short flag-red stroke around a party logo on tap. */
export function PartyMark({ children, className, label }: PartyMarkProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [strokeKey, setStrokeKey] = useState(0);

  return (
    <span
      className={cn('relative inline-flex overflow-hidden', className)}
      onPointerDown={() => {
        if (reducedMotion) return;
        setStrokeKey((key) => key + 1);
      }}
    >
      {children}
      {strokeKey > 0 ? (
        <motion.svg
          key={strokeKey}
          viewBox="0 0 24 24"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          <title>{label}</title>
          <motion.circle
            cx="12"
            cy="12"
            r="10.2"
            fill="none"
            stroke={FLAG_RED}
            strokeWidth="1.6"
            pathLength={1}
            initial={{ pathLength: 0, opacity: 0.9 }}
            animate={{ pathLength: 1, opacity: 0 }}
            transition={{ duration: 0.55, ease: MOTION_EASE }}
          />
        </motion.svg>
      ) : null}
    </span>
  );
}
