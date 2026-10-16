'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';

export type LandingFaqItem = {
  id: string;
  question: string;
  answer: string;
};

type LandingFaqAccordionProps = {
  items: readonly LandingFaqItem[];
  className?: string;
};

/** FAQ accordion (pattern inspired by 21st.dev FAQ Accordion Reveal). */
export function LandingFaqAccordion({ items, className }: LandingFaqAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div
            key={item.id}
            className={cn(
              'overflow-hidden rounded-2xl border border-[#00205b]/10 bg-white shadow-sm transition-colors',
              open && 'border-[#00205b]/20 bg-[#00205b]/[0.02]',
            )}
          >
            <button
              type="button"
              id={`faq-${item.id}`}
              aria-expanded={open}
              aria-controls={`faq-panel-${item.id}`}
              onClick={() => setOpenId(open ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-base font-semibold text-[#001433]">{item.question}</span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-[#00205b]/60 transition-transform duration-200',
                  open && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  id={`faq-panel-${item.id}`}
                  role="region"
                  aria-labelledby={`faq-${item.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="px-5 pb-4 text-sm leading-relaxed text-[#001433]/70">{item.answer}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
