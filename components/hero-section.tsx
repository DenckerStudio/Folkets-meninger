'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { motion } from 'motion/react';
import { routes } from '@/lib/routes';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

export default function HeroSection() {
  const reducedMotion = usePrefersReducedMotion();

  const sectionClass =
    'relative overflow-hidden text-center py-24 sm:py-32 w-[100vw] left-[50%] right-[50%] -ml-[50vw] -mr-[50vw] border-b border-gray-200 bg-gradient-to-br from-[#ba0c2f]/10 via-[#ffffff] to-[#00205b]/10 -mt-8 mb-12';

  const content = (
    <>
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[600px] h-[600px] bg-[#ba0c2f]/10 blur-[120px] rounded-full pointer-events-none" />
      <div
        className={`absolute bottom-0 right-1/4 translate-x-1/2 w-[600px] h-[600px] bg-[#00205b]/10 blur-[120px] rounded-full pointer-events-none ${reducedMotion ? '' : 'animate-pulse-slow'}`}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-700 text-sm font-medium mb-8 border border-indigo-100">
          <span
            className={`flex h-2 w-2 bg-indigo-600 mr-2 rounded-full ${reducedMotion ? '' : 'animate-pulse'}`}
          />
          Demokratiet fortsetter mellom valgene
        </div>

        <h1 className="text-5xl tracking-tight font-extrabold text-gray-900 sm:text-6xl md:text-7xl mb-6">
          <span className="block mb-2">Din stemme teller.</span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">
            Også mellom valgene.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-600 sm:text-xl leading-relaxed">
          Folkets Stemme er en nøytral plattform som brobygger mellom Stortinget og innbyggerne. Si din mening om
          aktuelle saker med verifisert stemmegivning.
        </p>

        <div className="mt-10 max-w-md mx-auto sm:flex sm:justify-center gap-4">
          <Link
            href={routes.login}
            className="w-full sm:w-auto flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium text-white bg-gray-900 hover:bg-gray-800 transition-all duration-200 md:text-lg shadow-sm"
          >
            Kom i gang
          </Link>
          <Link
            href={routes.login}
            className="mt-3 sm:mt-0 w-full sm:w-auto flex items-center justify-center px-8 py-4 border border-gray-300 text-base font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 md:text-lg shadow-sm"
          >
            Logg inn
          </Link>
        </div>

        <div className="mt-16 inline-flex items-start text-left bg-white border border-gray-200 p-5 max-w-2xl mx-auto shadow-sm">
          <Info className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 leading-relaxed">
            <strong className="text-gray-900">Uavhengig plattform:</strong> Vi samarbeider ikke med Regjeringen eller
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
