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
 * Soft Blur In (21st.dev text-component pattern).
 * Blurs into focus on enter-view for readable motion.
 */
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
        initial={reduceMotion ? false : { opacity: 0, filter: 'blur(10px)', y: 12 }}
        whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration, delay, ease: 'easeOut' }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
