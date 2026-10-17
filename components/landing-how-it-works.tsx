'use client';

import { GrainGradient } from '@paper-design/shaders-react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { LandingSectionContainer } from '@/components/landing-section-container';
import HowItWorks from '@/components/ui/how-it-works';

const GRAIN_COLORS = ['#f4d4db', '#ba0c2f', '#00205b', '#d9e4f5'];

/** Landing “Slik fungerer det” with pin-board cards + soft grain shader backdrop. */
export function LandingHowItWorks() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section className="relative w-full overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 88%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 88%, transparent 100%)',
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
        }}
        aria-hidden
      >
        {reducedMotion ? (
          <div className="absolute inset-0 bg-gradient-to-b from-[#ba0c2f]/[0.04] via-background to-[#00205b]/[0.05]" />
        ) : (
          <>
            <GrainGradient
              className="absolute inset-0 h-full w-full opacity-40 dark:opacity-30"
              colors={GRAIN_COLORS}
              colorBack="var(--background)"
              speed={0.25}
              softness={0.75}
              intensity={0.35}
              noise={0.35}
              shape="blob"
            />
            <div className="absolute inset-0 bg-background/70" />
          </>
        )}
      </div>
      <LandingSectionContainer className="relative z-10">
        <HowItWorks className="px-0 sm:px-0" />
      </LandingSectionContainer>
    </section>
  );
}
