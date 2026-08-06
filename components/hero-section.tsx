'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { motion } from 'motion/react';
import { routes } from '@/lib/routes';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

export default function HeroSection() {
  const reducedMotion = usePrefersReducedMotion();

  const sectionClass =
    'landing-hero relative overflow-hidden text-center py-24 sm:py-32 w-[100vw] left-[50%] right-[50%] -ml-[50vw] -mr-[50vw] border-b border-[#00205b]/10 bg-white -mt-8 mb-12';

  const content = (
    <>
      {/* Mesh: soft overlapping flag-color fields */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-[20%] -left-[15%] h-[70%] w-[55%] rounded-full bg-[#ba0c2f]/[0.22] blur-[90px]" />
        <div className="absolute top-[10%] right-[-10%] h-[55%] w-[50%] rounded-full bg-[#00205b]/[0.2] blur-[100px]" />
        <div className="absolute bottom-[-15%] left-[20%] h-[50%] w-[45%] rounded-full bg-[#00205b]/[0.14] blur-[110px]" />
        <div className="absolute top-[35%] left-[35%] h-[40%] w-[40%] rounded-full bg-white/80 blur-[80px]" />
        <div className="absolute top-[5%] left-[45%] h-[30%] w-[28%] rounded-full bg-[#ba0c2f]/[0.12] blur-[70px]" />
        <div className="absolute bottom-[10%] right-[25%] h-[35%] w-[30%] rounded-full bg-[#00205b]/[0.1] blur-[80px]" />
      </div>

      {/* Thin tricolor edge */}
      <div className="absolute top-0 inset-x-0 flex h-px pointer-events-none" aria-hidden>
        <span className="flex-1 bg-[#ba0c2f]/70" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#00205b]/70" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 bg-white/80 text-[#00205b] text-sm font-medium mb-8 border border-[#00205b]/12 backdrop-blur-sm">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[#ba0c2f] ${reducedMotion ? '' : 'animate-pulse'}`}
          />
          Demokratiet fortsetter mellom valgene
        </div>

        <h1 className="text-5xl tracking-tight font-extrabold text-[#001433] sm:text-6xl md:text-7xl mb-6 drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">
          <span className="block mb-2">Din stemme teller.</span>
          <span className="block text-[#001433]">Også mellom valgene.</span>
        </h1>

        <p className="mt-6 max-w-2xl mx-auto text-lg text-[#001433]/75 sm:text-xl leading-relaxed">
          Folkets Stemme er en nøytral plattform som brobygger mellom Stortinget og innbyggerne. Si din mening om
          aktuelle saker med verifisert stemmegivning.
        </p>

        <div className="mt-10 max-w-md mx-auto flex flex-col sm:flex-row sm:justify-center gap-3">
          <Link
            href={routes.login}
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-full px-8 py-3.5 text-base font-semibold text-white bg-[#00205b] hover:bg-[#001a4a] transition-colors duration-200 md:text-lg shadow-sm"
          >
            Kom i gang
          </Link>
          <Link
            href={routes.login}
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-full px-8 py-3.5 text-base font-semibold text-[#00205b] bg-white/80 hover:bg-white border border-[#00205b]/15 transition-colors duration-200 md:text-lg backdrop-blur-sm"
          >
            Logg inn
          </Link>
        </div>

        <div className="mt-16 inline-flex items-start text-left rounded-2xl bg-white/70 border border-[#00205b]/10 px-5 py-4 max-w-2xl mx-auto backdrop-blur-sm">
          <Info className="w-4 h-4 text-[#00205b]/50 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#001433]/70 leading-relaxed">
            <strong className="font-semibold text-[#001433]">Uavhengig plattform:</strong> Vi samarbeider ikke med
            Regjeringen eller Stortinget. Dette er et uavhengig initiativ for å styrke demokratiet. Vårt håp er at
            politikerne på sikt vil ta i bruk dataene og lytte til folket her inne.
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
      transition={{ duration: 1.2, ease: 'easeOut' }}
      className={sectionClass}
    >
      {content}
    </motion.section>
  );
}
