'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { motion } from 'motion/react';
import { routes } from '@/lib/routes';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

export default function HeroSection() {
  const reducedMotion = usePrefersReducedMotion();

  const sectionClass =
    'landing-hero relative overflow-hidden text-center py-24 sm:py-32 w-[100vw] left-[50%] right-[50%] -ml-[50vw] -mr-[50vw] border-b border-[#00205b]/15 bg-gradient-to-br from-[#ba0c2f]/30 via-white to-[#00205b]/28 -mt-8 mb-12';

  const content = (
    <>
      {/* Tricolor accent — rødt, hvitt, blått */}
      <div className="absolute top-0 inset-x-0 flex h-1.5 pointer-events-none" aria-hidden>
        <span className="flex-1 bg-[#ba0c2f]" />
        <span className="flex-[0.85] bg-white shadow-[inset_0_-1px_0_rgba(0,32,91,0.12),inset_0_1px_0_rgba(0,32,91,0.12)]" />
        <span className="flex-1 bg-[#00205b]" />
      </div>

      {/* Soft flag-cross motif (offset like norsk flagg) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.11] mix-blend-multiply"
        aria-hidden
      >
        <div className="absolute left-[26%] top-0 h-full w-[14%] bg-[#00205b]" />
        <div className="absolute left-0 top-[30%] h-[14%] w-full bg-[#ba0c2f]" />
      </div>

      <div className="absolute top-0 left-[18%] -translate-x-1/2 w-[min(720px,90vw)] h-[min(720px,70vh)] bg-[#ba0c2f]/35 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-[18%] translate-x-1/2 w-[min(720px,90vw)] h-[min(720px,70vh)] bg-[#00205b]/32 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[320px] bg-white/70 blur-[80px] rounded-full pointer-events-none" />

      <div
        className={`absolute bottom-0 right-1/4 translate-x-1/2 w-[400px] h-[400px] bg-[#00205b]/20 blur-[90px] rounded-full pointer-events-none ${reducedMotion ? '' : 'animate-pulse-slow'}`}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center px-3 py-1.5 bg-white/90 text-[#00205b] text-sm font-semibold mb-8 border border-[#00205b]/20 shadow-sm ring-1 ring-[#ba0c2f]/15">
          <span
            className={`flex h-2 w-2 bg-[#ba0c2f] mr-2 rounded-full ${reducedMotion ? '' : 'animate-pulse'}`}
          />
          Demokratiet fortsetter mellom valgene
        </div>

        <h1 className="text-5xl tracking-tight font-extrabold text-[#00205b] sm:text-6xl md:text-7xl mb-6">
          <span className="block mb-2">Din stemme teller.</span>
          <span
            className="block text-transparent bg-clip-text bg-gradient-to-r from-[#ba0c2f] via-[#00205b] to-[#00205b]"
          >
            Også mellom valgene.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl mx-auto text-lg text-[#00205b]/80 sm:text-xl leading-relaxed">
          Folkets Stemme er en nøytral plattform som brobygger mellom Stortinget og innbyggerne. Si din mening om
          aktuelle saker med verifisert stemmegivning.
        </p>

        <div className="mt-10 max-w-md mx-auto sm:flex sm:justify-center gap-4">
          <Link
            href={routes.login}
            className="w-full sm:w-auto flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium text-white bg-[#00205b] hover:bg-[#001a4a] transition-all duration-200 md:text-lg shadow-md shadow-[#00205b]/25"
          >
            Kom i gang
          </Link>
          <Link
            href={routes.login}
            className="mt-3 sm:mt-0 w-full sm:w-auto flex items-center justify-center px-8 py-4 border-2 border-[#ba0c2f]/35 text-base font-medium text-[#00205b] bg-white hover:bg-[#ba0c2f]/5 transition-all duration-200 md:text-lg shadow-sm"
          >
            Logg inn
          </Link>
        </div>

        <div className="mt-16 inline-flex items-start text-left bg-white/95 border border-[#00205b]/15 p-5 max-w-2xl mx-auto shadow-sm ring-1 ring-[#ba0c2f]/10">
          <Info className="w-5 h-5 text-[#00205b]/60 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#00205b]/75 leading-relaxed">
            <strong className="text-[#00205b]">Uavhengig plattform:</strong> Vi samarbeider ikke med Regjeringen eller
            Stortinget. Dette er et uavhengig initiativ for å styrke demokratiet. Vårt håp er at politikerne på sikt vil
            ta i bruk dataene og lytte til folket her inne.
          </p>
        </div>
      </div>
    </>
  );

  if (reducedMotion) {
    return <section className={sectionClass}>{content}</section>;
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
      className={sectionClass}
    >
      {content}
    </motion.section>
  );
}
