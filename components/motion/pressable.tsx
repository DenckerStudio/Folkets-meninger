'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { FLAG_RED, PRESS_DURATION } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

type PressableProps = {
  children: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  'aria-label'?: string;
};

/** Brief red press, no bounce. */
export function Pressable({
  children,
  className,
  type = 'button',
  disabled,
  onClick,
  'aria-label': ariaLabel,
}: PressableProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      whileTap={reducedMotion || disabled ? undefined : { backgroundColor: FLAG_RED, color: '#ffffff' }}
      transition={{ duration: PRESS_DURATION, ease: 'linear' }}
      className={cn(className)}
    >
      {children}
    </motion.button>
  );
}
