'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { motion } from 'motion/react';
import { routes } from '@/lib/routes';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { LandingMeshBackground } from '@/components/landing-mesh-background';
import { STANCE_AGGREGATE_DISCLOSURE } from '@/lib/copy/stance-privacy';
import { pollBallotRunningTextPhrase } from '@/lib/polls/ballot-buttons';
import type { LandingOpenPollsSnapshot } from '@/lib/landing/home-data';
import { formatNumber } from '@/lib/utils';

/** Short pitch in the hero info card — keep in sync with product positioning. */
export const LANDING_HERO_CARD_COPY =
  `Følg sakene Stortinget stemmer over. Si hva du mener på konkrete forslag. ${STANCE_AGGREGATE_DISCLOSURE}`;

export type HeroSectionClientProps = {
  pollsSnapshot: LandingOpenPollsSnapshot | null;
};

function HeroLiveStats({ snapshot }: { snapshot: LandingOpenPollsSnapshot }) {
  if (snapshot.openCount <= 0) return null;

  return (
    <Link
      href={routes.avstemninger}
      className="mx-auto mt-8 flex w-full max-w-xl min-h-11 flex-col gap-2 rounded-2xl border border-[#ba0c2f]/25 bg-white/90 px-4 py-4 text-sm text-[#001433] shadow-sm backdrop-blur-md transition-colors hover:border-[#00205b]/35 hover:bg-white sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-6 sm:gap-y-1"
      role="status"
    >
      <span className="inline-flex items-center justify-center gap-2 font-semibold text-[#00205b]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#ba0c2f]" aria-hidden />
        {formatNumber(snapshot.openCount)} åpne avstemning{snapshot.openCount === 1 ? '' : 'er'}
      </span>
      {snapshot.nearestDeadlineLabel ? (
        <span className="text-[#001433]/75">
          Nærmeste frist: <span className="font-medium text-[#001433]">{snapshot.nearestDeadlineLabel}</span>
        </span>
      ) : null}
      {snapshot.publicVoteCount != null ? (
        <span className="text-[#001433]/75">
          {formatNumber(snapshot.publicVoteCount)} stemmer registrert (samlet, uten navn)
        </span>
      ) : null}
      <span className="sr-only">Gå til åpne avstemninger</span>
    </Link>
  );
}

export function HeroSectionClient({ pollsSnapshot }: HeroSectionClientProps) {
  const reducedMotion = usePrefersReducedMotion();

  const sectionClass =
    'landing-hero relative z-0 flex w-full min-h-[min(88vh,52rem)] flex-col items-center justify-center overflow-hidden bg-background py-16 pb-10 text-center sm:py-20 sm:pb-12';

  return (
    <section className={sectionClass}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-[#ba0c2f] via-white to-[#00205b]"
        aria-hidden
      />
      <LandingMeshBackground />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 bg-white/90 text-[#00205b] text-sm font-medium mb-8 border border-[#00205b]/15 backdrop-blur-md shadow-sm"
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[#ba0c2f] ${reducedMotion ? '' : 'animate-pulse'}`}
          />
          Norsk demokrati — uavhengig plattform
        </motion.div>

        <motion.h1
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: 'easeOut' }}
          className="text-4xl tracking-tight font-extrabold text-[#001433] sm:text-6xl md:text-7xl mb-6 drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]"
        >
          <span className="block mb-2">Følg Stortinget.</span>
          <span className="block bg-gradient-to-r from-[#ba0c2f] via-[#001433] to-[#00205b] bg-clip-text text-transparent">
            Stem mellom valgene.
          </span>
        </motion.h1>

        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.4, ease: 'easeOut' }}
          className="mt-6 max-w-2xl mx-auto text-lg text-[#001433]/80 sm:text-xl leading-relaxed"
        >
          Konkrete forslag fra Stortinget, åpne avstemninger med {pollBallotRunningTextPhrase()}, og sammenligning
          når nok har deltatt — uten at stemmen knyttes til navnet ditt.
        </motion.p>

        {pollsSnapshot ? <HeroLiveStats snapshot={pollsSnapshot} /> : null}

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: 'easeOut' }}
          className="mt-8 sm:mt-10 max-w-sm sm:max-w-md mx-auto flex flex-col sm:flex-row sm:justify-center gap-2.5 sm:gap-3"
        >
          <Link
            href={routes.login}
            className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-[#ba0c2f] shadow-md transition-colors duration-200 hover:bg-[#00205b] sm:px-7 sm:py-3 sm:text-base"
          >
            Kom i gang gratis
          </Link>
          <Link
            href={routes.utforsk}
            className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-full border-2 border-[#00205b]/20 bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#00205b] backdrop-blur-md transition-colors duration-200 hover:border-[#00205b]/45 hover:bg-white sm:px-7 sm:py-3 sm:text-base"
          >
            Utforsk saker
          </Link>
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.7, ease: 'easeOut' }}
          className="mx-auto mt-12 flex w-full max-w-xl flex-col items-center justify-center rounded-2xl border border-[#00205b]/10 bg-white/85 px-6 py-7 text-center shadow-sm backdrop-blur-md sm:mt-14 sm:px-8 sm:py-8"
        >
          <Info className="mb-3 h-5 w-5 shrink-0 text-[#00205b]/55" aria-hidden />
          <p className="text-pretty text-sm leading-relaxed text-[#001433]/75 sm:text-base">
            {LANDING_HERO_CARD_COPY}
          </p>
        </motion.div>
      </div>
    </section>
  );
}