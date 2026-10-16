'use client';

import { cn } from '@/lib/utils';

export type LandingFactStat = {
  label: string;
  value: string;
  detail: string;
};

type LandingFactStatsProps = {
  items: readonly LandingFactStat[];
  className?: string;
};

/** Stat-style fact grid (layout inspired by 21st.dev stats cards). */
export function LandingFactStats({ items, className }: LandingFactStatsProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col rounded-2xl border border-[#00205b]/10 bg-white p-5 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#ba0c2f]">{item.label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#001433]">{item.value}</p>
          <p className="mt-2 text-sm leading-relaxed text-pretty text-[#001433]/65">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}
