'use client';

import type { ReactNode } from 'react';
import { LazyMotion, domAnimation, m } from 'motion/react';
import { cn } from '@/lib/utils';

export type RoadmapStatus = 'done' | 'in-progress' | 'upcoming';

export type RoadmapItem = {
  quarter: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  children?: ReactNode;
};

export type RoadmapCardProps = {
  items: RoadmapItem[];
  title?: string;
  subtitle?: string;
  className?: string;
};

const STATUS_LABEL: Record<RoadmapStatus, string> = {
  done: 'Ferdig',
  'in-progress': 'Pågår',
  upcoming: 'Kommer',
};

const STATUS_CLASS: Record<RoadmapStatus, string> = {
  done: 'bg-[#00205b]/[0.08] text-[#00205b] border-[#00205b]/15',
  'in-progress': 'bg-[#ba0c2f]/[0.1] text-[#ba0c2f] border-[#ba0c2f]/20',
  upcoming: 'bg-[#001433]/[0.05] text-[#001433]/60 border-[#00205b]/10',
};

const DOT_CLASS: Record<RoadmapStatus, string> = {
  done: 'bg-[#00205b]',
  'in-progress': 'bg-[#ba0c2f]',
  upcoming: 'bg-[#00205b]/30',
};

/**
 * RoadmapCard (21st.dev / Berat Berkay Gökdemir).
 * Minimal animated product roadmap with quarterly milestones and status.
 */
export function RoadmapCard({
  items,
  title = 'Veien videre',
  subtitle,
  className,
}: RoadmapCardProps) {
  return (
    <section className={cn('relative', className)}>
      <div className="mb-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">Roadmap</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#001433] sm:text-4xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-3 text-base leading-relaxed text-[#001433]/65 sm:text-lg">{subtitle}</p>
        ) : null}
      </div>

      <LazyMotion features={domAnimation}>
        <ol className="relative space-y-0">
          <div
            className="absolute bottom-2 left-[11px] top-2 w-px bg-gradient-to-b from-[#ba0c2f]/50 via-[#00205b]/25 to-[#00205b]/10"
            aria-hidden
          />
          {items.map((item, index) => (
            <m.li
              key={`${item.quarter}-${item.title}`}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: index * 0.08, ease: 'easeOut' }}
              className={cn('relative pl-10', index === items.length - 1 ? 'pb-0' : 'pb-10')}
            >
              <m.span
                whileHover={{ scale: 1.15 }}
                className={cn(
                  'absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white',
                  DOT_CLASS[item.status],
                )}
                aria-hidden
              >
                <span className="h-2 w-2 rounded-full bg-white" />
              </m.span>

              <div className="rounded-2xl border border-[#00205b]/10 bg-white p-5 transition-colors hover:border-[#00205b]/25 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#00205b]/70">
                    {item.quarter}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                      STATUS_CLASS[item.status],
                    )}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-bold text-[#001433] sm:text-xl">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#001433]/65 sm:text-base">
                  {item.description}
                </p>
                {item.children ? <div className="mt-4">{item.children}</div> : null}
              </div>
            </m.li>
          ))}
        </ol>
      </LazyMotion>
    </section>
  );
}
