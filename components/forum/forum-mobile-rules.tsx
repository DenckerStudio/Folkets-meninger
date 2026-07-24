'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Shield } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

export function ForumMobileRules() {
  const [open, setOpen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="xl:hidden mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 transition-colors active:bg-gray-50"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600" />
          Forumregler
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <ul className="mt-2 rounded-xl border border-gray-200 bg-white p-4 space-y-2 text-xs text-gray-600">
              <li>Innlegg er offentlige og viser ditt navn (fornavn og etternavn).</li>
              <li>Hold en saklig og respektfull tone.</li>
              <li>Ingen hat, trakassering, porno eller spam.</li>
              <li>Du må være logget inn for å skrive.</li>
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
