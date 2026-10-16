'use client';

import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
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
};

/**
 * 2×2 bento-style feature grid (layout adapted from 21st.dev ln-dev7/bento-01).
 */
export function BentoFeatureGrid({ tiles, className }: BentoFeatureGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5',
        className,
      )}
    >
      {tiles.map(({ icon: Icon, title, body, accentClassName, className: tileClass }) => (
        <article
          key={title}
          className={cn(
            'flex h-full min-h-0 flex-col gap-5 rounded-2xl border border-[#00205b]/10 bg-white p-6 shadow-sm sm:p-8',
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
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#001433] sm:text-lg">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-pretty text-[#001433]/70">{body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
