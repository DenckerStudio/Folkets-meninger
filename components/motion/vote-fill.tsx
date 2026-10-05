'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { MOTION_EASE } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

type VoteFillButtonProps = {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  selectedClassName?: string;
  idleClassName?: string;
  children: ReactNode;
};

/** A vote (ja / nei / blank) fills quietly when it is cast. */
export function VoteFillButton({
  selected,
  disabled,
  onClick,
  className,
  selectedClassName,
  idleClassName,
  children,
}: VoteFillButtonProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn('relative overflow-hidden', className, selected ? selectedClassName : idleClassName)}
    >
      {selected ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 bg-[#ba0c2f]"
          initial={reducedMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.38, ease: MOTION_EASE }}
          style={{ transformOrigin: 'left center' }}
        />
      ) : null}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
