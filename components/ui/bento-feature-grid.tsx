'use client';

import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BentoFeatureTile = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: ReactNode;
  accentClassName?: string;
  className?: string;
};

type BentoFeatureGridProps = {
  tiles: BentoFeatureTile[];
  className?: string;
  /** Overrides flex gap between icon and text block (default gap-5). */
  tileGapClassName?: string;
  /** Extra classes on the text block (e.g. mt-3 between icon and title). */
  tileContentClassName?: string;
};

/** 2×2 bento-style feature grid (layout adapted from 21st.dev ln-dev7/bento-01). */
export function BentoFeatureGrid({
  tiles,
  className,
  tileGapClassName = 'gap-5',
  tileContentClassName,
}: BentoFeatureGridProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5', className)}>
      {tiles.map(({ icon: Icon, title, body, accentClassName, className: tileClass }) => (
        <article
          key={title}
          className={cn(
            'flex h-full min-h-0 flex-col rounded-2xl border border-[#00205b]/10 bg-white p-6 shadow-sm sm:p-8',
            tileGapClassName,
            tileClass,
          )}
        >
          <div
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-xl border border-[#00205b]/10 bg-[#00205b]/[0.04]',
              accentClassName ?? 'text-[#00205b]',
            )}
          >
            <Icon className="size-5" strokeWidth={1.5} aria-hidden />
          </div>
          <div className={cn('min-w-0', tileContentClassName)}>
            <h3 className="text-base font-semibold text-[#001433] sm:text-lg">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-pretty text-[#001433]/70">{body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
