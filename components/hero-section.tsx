'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { motion } from 'motion/react';
import { routes } from '@/lib/routes';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { LandingMeshBackground } from '@/components/landing-mesh-background';
import { STANCE_AGGREGATE_DISCLOSURE } from '@/lib/copy/stance-privacy';

/** Short pitch in the hero info card — keep in sync with product positioning. */
export const LANDING_HERO_CARD_COPY =
  `Følg sakene Stortinget stemmer over. Si hva du mener på konkrete forslag. ${STANCE_AGGREGATE_DISCLOSURE}`;

export default function HeroSection() {
  const reducedMotion = usePrefersReducedMotion();

  const sectionClass =
    'landing-hero relative z-0 -mb-28 flex w-full min-h-[min(88vh,52rem)] items-center overflow-hidden bg-background py-16 sm:py-20 text-center';

  const content = (
    <>
      <LandingMeshBackground />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 bg-white/85 text-[#00205b] text-sm font-medium mb-8 border border-[#00205b]/12 backdrop-blur-md shadow-sm"
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[#ba0c2f] ${reducedMotion ? '' : 'animate-pulse'}`}
          />
          Uavhengig plattform
        </motion.div>

        <motion.h1
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: 'easeOut' }}
          className="text-5xl tracking-tight font-extrabold text-[#001433] sm:text-6xl md:text-7xl mb-6 drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]"
        >
          <span className="block mb-2">Din stemme teller.</span>
          <span className="block text-[#001433]">Også mellom valgene.</span>
        </motion.h1>

        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.4, ease: 'easeOut' }}
          className="mt-6 max-w-2xl mx-auto text-lg text-[#001433]/75 sm:text-xl leading-relaxed"
        >
          Si din mening med Ja, Nei eller Blank i avstemninger. Stemmen telles bare i samlet statistikk — uten navn.
        </motion.p>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: 'easeOut' }}
          className="mt-8 sm:mt-10 max-w-sm sm:max-w-md mx-auto flex flex-col sm:flex-row sm:justify-center gap-2.5 sm:gap-3"
        >
          <Link
            href={routes.utforsk}
            className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-[#00205b] shadow-sm transition-colors duration-200 hover:bg-[#ba0c2f] sm:px-7 sm:py-3 sm:text-base"
          >
            Utforsk saker
          </Link>
          <Link
            href={routes.login}
            className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-full border border-[#00205b]/15 bg-white/85 px-5 py-2.5 text-sm font-semibold text-[#00205b] backdrop-blur-md transition-colors duration-200 hover:border-[#00205b]/40 hover:bg-white sm:px-7 sm:py-3 sm:text-base"
          >
            Logg inn
          </Link>
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.7, ease: 'easeOut' }}
          className="mx-auto mt-12 flex w-full max-w-xl flex-col items-center justify-center rounded-2xl border border-[#00205b]/10 bg-white/80 px-6 py-7 text-center shadow-sm backdrop-blur-md sm:mt-14 sm:px-8 sm:py-8"
        >
          <Info className="mb-3 h-5 w-5 shrink-0 text-[#00205b]/55" aria-hidden />
          <p className="text-pretty text-sm leading-relaxed text-[#001433]/75 sm:text-base">
            {LANDING_HERO_CARD_COPY}
          </p>
        </motion.div>
      </div>
    </>
  );

  return <section className={sectionClass}>{content}</section>;
}
