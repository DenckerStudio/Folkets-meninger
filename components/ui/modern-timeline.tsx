'use client';

import type { ReactNode } from 'react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { SoftBlurIn } from '@/components/ui/soft-blur-in';
import { TextGradient } from '@/components/ui/text-gradient';

export type TimelineStatus = 'completed' | 'current' | 'upcoming';

export type TimelineItem = {
  title: string;
  description: string;
  date: string;
  category: string;
  status: TimelineStatus;
  detail?: ReactNode;
};

export type ModernTimelineProps = {
  items: TimelineItem[];
  title?: string;
  subtitle?: string;
  className?: string;
};

const STATUS_LABEL: Record<TimelineStatus, string> = {
  completed: 'Ferdig',
  current: 'Pågår',
  upcoming: 'Kommer',
};

const STATUS_CLASS: Record<TimelineStatus, string> = {
  completed: 'text-[#00205b] bg-[#00205b]/[0.08]',
  current: 'text-[#ba0c2f] bg-[#ba0c2f]/[0.1]',
  upcoming: 'text-[#001433]/55 bg-[#001433]/[0.05]',
};

const DOT_CLASS: Record<TimelineStatus, string> = {
  completed: 'border-[#00205b] bg-[#00205b]',
  current: 'border-[#ba0c2f] bg-[#ba0c2f] shadow-[0_0_0_6px_rgba(186,12,47,0.12)]',
  upcoming: 'border-[#00205b]/30 bg-white',
};

/**
 * Modern Timeline (21st.dev / Caio Bonato).
 * Aesthetic alternating roadmap — typography-led, no card chrome.
 */
export function Timeline({ items, title, subtitle, className }: ModernTimelineProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className={cn('relative', className)}>
      {(title || subtitle) && (
        <header className="mx-auto mb-16 max-w-3xl text-center">
          <SoftBlurIn>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">Roadmap</p>
          </SoftBlurIn>
          {title ? (
            <SoftBlurIn delay={0.06}>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                <TextGradient as="span" colors={['#001433', '#00205b', '#ba0c2f', '#001433']} duration={8}>
                  {title}
                </TextGradient>
              </h2>
            </SoftBlurIn>
          ) : null}
          {subtitle ? (
            <SoftBlurIn delay={0.12}>
              <p className="mt-4 text-lg leading-relaxed text-[#001433]/65">{subtitle}</p>
            </SoftBlurIn>
          ) : null}
        </header>
      )}

      <LazyMotion features={domAnimation}>
        <ol className="relative mx-auto max-w-5xl">
          <div
            className="pointer-events-none absolute bottom-4 left-4 top-4 w-px bg-gradient-to-b from-[#ba0c2f] via-[#00205b]/40 to-transparent sm:left-1/2 sm:-translate-x-px"
            aria-hidden
          />

          {items.map((item, index) => {
            const isLeft = index % 2 === 0;

            return (
              <m.li
                key={`${item.date}-${item.title}`}
                initial={reduceMotion ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: index * 0.05, ease: 'easeOut' }}
                className="relative grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-5 pb-14 last:pb-2 sm:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] sm:gap-10"
              >
                <div className="hidden pt-0.5 sm:block">
                  {isLeft ? <TimelineCopy item={item} align="right" /> : <span className="sr-only" />}
                </div>

                <div className="relative z-10 col-start-1 row-start-1 flex justify-center pt-1.5 sm:col-start-2">
                  <span
                    className={cn('block h-4 w-4 rounded-full border-2', DOT_CLASS[item.status])}
                    aria-hidden
                  />
                </div>

                <div className="col-start-2 row-start-1 sm:col-start-3">
                  <div className="sm:hidden">
                    <TimelineCopy item={item} align="left" />
                  </div>
                  <div className="hidden sm:block">
                    {!isLeft ? <TimelineCopy item={item} align="left" /> : null}
                  </div>
                </div>
              </m.li>
            );
          })}
        </ol>
      </LazyMotion>
    </section>
  );
}

function TimelineCopy({
  item,
  align,
}: {
  item: TimelineItem;
  align: 'left' | 'right';
}) {
  return (
    <article className={cn('max-w-md', align === 'right' && 'sm:ml-auto')}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-2',
          align === 'right' && 'sm:justify-end',
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#00205b]/70">
          {item.category}
        </span>
        <span className="text-xs text-[#001433]/45">{item.date}</span>
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
            STATUS_CLASS[item.status],
          )}
        >
          {STATUS_LABEL[item.status]}
        </span>
      </div>
      <h3 className="mt-2 text-xl font-bold tracking-tight text-[#001433] sm:text-2xl">
        {item.title}
      </h3>
      <p className="mt-2 text-base leading-relaxed text-[#001433]/65">{item.description}</p>
      {item.detail ? (
        <div className="mt-3 text-sm leading-relaxed text-[#001433]/70">{item.detail}</div>
      ) : null}
    </article>
  );
}

export { Timeline as ModernTimeline };
