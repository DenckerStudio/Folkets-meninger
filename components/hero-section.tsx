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
          Folkets Stemme er en nøytral plattform som brobygger mellom Stortinget og innbyggerne. Si din mening med
          Ja, Nei eller Blank — stemmen lagres anonymt i statistikken.
        </motion.p>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: 'easeOut' }}
          className="mt-8 sm:mt-10 max-w-sm sm:max-w-md mx-auto flex flex-col sm:flex-row sm:justify-center gap-2.5 sm:gap-3"
        >
          <Link
            href={routes.avstemninger}
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-[#00205b] shadow-sm transition-colors duration-200 hover:bg-[#ba0c2f] sm:px-7 sm:py-3 sm:text-base"
          >
            Se avstemninger
          </Link>
          <Link
            href={routes.login}
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-full border border-[#00205b]/15 bg-white/85 px-5 py-2.5 text-sm font-semibold text-[#00205b] backdrop-blur-md transition-colors duration-200 hover:border-[#00205b]/40 hover:bg-white sm:px-7 sm:py-3 sm:text-base"
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
          <p className="text-sm text-[#001433]/70 leading-relaxed">
            <strong className="font-semibold text-[#001433]">Uavhengig plattform:</strong> Vi samarbeider ikke med
            Regjeringen eller Stortinget. Dette er et uavhengig initiativ for å styrke demokratiet. Vårt håp er at
            politikerne på sikt vil ta i bruk dataene og lytte til folket her inne.
          </p>
        </motion.div>
      </div>
    </>
  );

  return <section className={sectionClass}>{content}</section>;
}
