'use client';

import type { ReactNode } from 'react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useRevealInView } from '@/hooks/use-reveal-in-view';

type SoftBlurInProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  amount?: number;
};

const EASE_OUT = [0.25, 0.1, 0.25, 1] as const;

/**
 * Landing scroll reveal: subtle opacity + translate-y (no blur).
 * Fades in once when in view; falls back to visible if the observer never fires.
 */
export function SoftBlurIn({
  children,
  className,
  delay = 0,
  duration = 0.55,
  amount = 0.2,
}: SoftBlurInProps) {
  const reduceMotion = useReducedMotion();
  const { ref, revealed } = useRevealInView<HTMLDivElement>({ amount, once: true });

  const hidden = { opacity: 0, y: 10 };
  const shown = { opacity: 1, y: 0 };

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        ref={ref}
        className={cn(className)}
        initial={reduceMotion ? shown : hidden}
        animate={revealed || reduceMotion ? shown : hidden}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                duration,
                delay: revealed ? delay : 0,
                ease: EASE_OUT,
              }
        }
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
