'use client';

import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { FLAG_NAVY, FLAG_RED, MOTION_EASE } from '@/lib/motion/tokens';

type FlagStripeProps = {
  animate?: boolean;
};

const STRIPES = [
  { fill: FLAG_RED, delay: 0 },
  { fill: '#ffffff', delay: 0.08 },
  { fill: FLAG_NAVY, delay: 0.16 },
] as const;

/** Norwegian flag stripe — red, white, navy — draws in from the left. */
export function FlagStripe({ animate = false }: FlagStripeProps) {
  const reducedMotion = usePrefersReducedMotion();
  const play = animate && !reducedMotion;

  return (
    <div className="flex h-1.5 w-full overflow-hidden" aria-hidden>
      {STRIPES.map((stripe) => (
        <motion.span
          key={stripe.fill}
          className="h-full flex-1"
          style={{ backgroundColor: stripe.fill, transformOrigin: 'left center' }}
          initial={play ? { scaleX: 0 } : { scaleX: 1 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.42, delay: play ? stripe.delay : 0, ease: MOTION_EASE }}
        />
      ))}
    </div>
  );
}
