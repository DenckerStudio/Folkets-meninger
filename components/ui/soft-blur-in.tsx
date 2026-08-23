'use client';

import type { ReactNode } from 'react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

type SoftBlurInProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
};

/**
 * 21st.dev Reveal + Magic UI Blur Fade.
 * Expo-out unblur with a short rise; waits until the block is a bit into view.
 */
const SMOOTH_EASE = [0.16, 1, 0.3, 1] as const;

export function SoftBlurIn({
  children,
  className,
  delay = 0,
  duration = 0.7,
}: SoftBlurInProps) {
  const reduceMotion = useReducedMotion();

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        className={cn(className)}
        initial={reduceMotion ? false : { opacity: 0, filter: 'blur(6px)', y: 10 }}
        whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
        viewport={{ once: true, amount: 0.45, margin: '0px 0px -12% 0px' }}
        transition={{ duration, delay, ease: SMOOTH_EASE }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
