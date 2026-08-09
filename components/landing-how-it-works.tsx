'use client';

import { GrainGradient } from '@paper-design/shaders-react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import HowItWorks from '@/components/ui/how-it-works';

const GRAIN_COLORS = ['#f4d4db', '#ba0c2f', '#00205b', '#d9e4f5'];

/** Landing “Slik fungerer det” with pin-board cards + soft grain shader backdrop. */
export function LandingHowItWorks() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section className="relative w-[100vw] left-[50%] right-[50%] -ml-[50vw] -mr-[50vw] overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {reducedMotion ? (
          <div className="absolute inset-0 bg-gradient-to-b from-[#ba0c2f]/[0.04] via-white to-[#00205b]/[0.05]" />
        ) : (
          <>
            <GrainGradient
              className="absolute inset-0 h-full w-full opacity-50"
              colors={GRAIN_COLORS}
              colorBack="#ffffff"
              speed={0.25}
              softness={0.75}
              intensity={0.35}
              noise={0.35}
              shape="blob"
            />
            <div className="absolute inset-0 bg-white/75" />
          </>
        )}
      </div>
      <div className="relative z-10 mx-auto max-w-7xl px-0">
        <HowItWorks />
      </div>
    </section>
  );
}
