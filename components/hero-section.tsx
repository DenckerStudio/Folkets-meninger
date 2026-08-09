'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { motion } from 'motion/react';
import { routes } from '@/lib/routes';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { LandingMeshBackground } from '@/components/landing-mesh-background';

export default function HeroSection() {
  const reducedMotion = usePrefersReducedMotion();

  const sectionClass =
    'landing-hero relative overflow-hidden text-center py-24 sm:py-32 w-[100vw] left-[50%] right-[50%] -ml-[50vw] -mr-[50vw] border-b border-[#00205b]/10 bg-white -mt-8 mb-12';

  const content = (
    <>
      <LandingMeshBackground />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 bg-white/85 text-[#00205b] text-sm font-medium mb-8 border border-[#00205b]/12 backdrop-blur-md shadow-sm"
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[#ba0c2f] ${reducedMotion ? '' : 'animate-pulse'}`}
          />
          Demokratiet fortsetter mellom valgene
        </motion.div>

        <motion.h1
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: 'easeOut' }}
          className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-[#001433] sm:text-6xl md:text-7xl mb-6 drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]"
        >
          <span className="block mb-2 sm:mb-3">Forstå politikken.</span>
          <span className="block text-[#00205b]">Delta mellom valgene.</span>
        </motion.h1>

        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.4, ease: 'easeOut' }}
          className="text-pretty mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#001433]/72 sm:text-lg sm:leading-relaxed"
        >
          Folkets Stemme er en uavhengig plattform som gjør stortingspolitikk tilgjengelig: les saker med
          AI-sammendrag, diskuter i forumet, følg høringer — og vis hva du mener når det betyr noe.
        </motion.p>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: 'easeOut' }}
          className="mt-10 max-w-md mx-auto flex flex-col sm:flex-row sm:justify-center gap-3"
        >
          <Link
            href={routes.login}
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-full px-8 py-3.5 text-base font-semibold text-white bg-[#00205b] hover:bg-[#ba0c2f] transition-colors duration-200 md:text-lg shadow-sm"
          >
            Kom i gang
          </Link>
          <Link
            href={routes.login}
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-full px-8 py-3.5 text-base font-semibold text-[#00205b] bg-white/85 hover:bg-white border border-[#00205b]/15 hover:border-[#00205b]/40 transition-colors duration-200 md:text-lg backdrop-blur-md"
          >
            Logg inn
          </Link>
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7, ease: 'easeOut' }}
          className="mt-16 inline-flex items-start text-left rounded-2xl bg-white/75 border border-[#00205b]/10 px-5 py-4 max-w-2xl mx-auto backdrop-blur-md shadow-sm"
        >
          <Info className="w-4 h-4 text-[#00205b]/50 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-pretty text-sm leading-relaxed text-[#001433]/70">
            <strong className="font-semibold text-[#001433]">Uavhengig initiativ.</strong> Vi er ikke en del av
            Regjeringen eller Stortinget. Målet er å gjøre det enklere for folk å følge med — og for politikere å se
            anonyme trender i hva velgerne mener.
          </p>
        </motion.div>
      </div>
    </>
  );

  return <section className={sectionClass}>{content}</section>;
}
