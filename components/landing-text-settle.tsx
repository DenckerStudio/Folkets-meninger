'use client';

import type { ReactNode } from 'react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import {
  LANDING_TEXT_SETTLE_DURATION,
  LANDING_TEXT_SETTLE_EASE,
  LANDING_TEXT_SETTLE_OPACITY_FROM,
  LANDING_TEXT_SETTLE_Y,
} from '@/lib/landing-text-motion';
import { cn } from '@/lib/utils';

type LandingTextSettleProps = {
  children: ReactNode;
  className?: string;
};

export function LandingTextSettle({ children, className }: LandingTextSettleProps) {
  const reduceMotion = useReducedMotion();

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        className={cn(className)}
        initial={
          reduceMotion
            ? false
            : { y: LANDING_TEXT_SETTLE_Y, opacity: LANDING_TEXT_SETTLE_OPACITY_FROM }
        }
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, amount: 0.35, margin: '0px 0px -8% 0px' }}
        transition={{ duration: LANDING_TEXT_SETTLE_DURATION, ease: LANDING_TEXT_SETTLE_EASE }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
