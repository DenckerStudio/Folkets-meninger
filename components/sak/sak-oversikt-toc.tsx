'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export type SakOversiktTocEntry = {
  id: string;
  label: string;
};

type SakOversiktTocProps = {
  entries: SakOversiktTocEntry[];
  variant: 'mobile' | 'desktop';
};

function useActiveSection(ids: string[]) {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    if (ids.length === 0) return undefined;
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-15% 0px -65% 0px', threshold: [0, 0.15, 1] },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [ids]);

  return activeId;
}

const tocLinkClass = (active: boolean) =>
  cn(
    'flex min-h-11 items-center rounded-lg px-2 py-1.5 text-muted-foreground underline-offset-2 hover:bg-brand/5 hover:text-brand-accent',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
    active && 'bg-brand/10 font-semibold text-brand',
  );

export function SakOversiktToc({ entries, variant }: SakOversiktTocProps) {
  const ids = useMemo(() => entries.map((e) => e.id), [entries]);
  const activeId = useActiveSection(ids);

  if (entries.length === 0) return null;

  if (variant === 'mobile') {
    return (
      <nav className="lg:hidden" aria-label="Hopp til seksjon">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hopp til seksjon
        </p>
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {entries.map((entry) => {
            const active = activeId === entry.id;
            return (
              <li key={entry.id} className="shrink-0">
                <a
                  href={`#${entry.id}`}
                  aria-current={active ? 'location' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    active
                      ? 'border-brand/30 bg-brand/10 text-brand'
                      : 'border-border bg-card text-muted-foreground hover:border-brand/30 hover:text-brand',
                  )}
                >
                  {entry.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      className="sticky-below-sak-page-tabs hidden max-h-[calc(100vh-9rem)] overflow-y-auto lg:block"
      aria-label="Innhold i oversikten"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">På denne siden</p>
      <ul className="mt-3 space-y-1 text-sm">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className={tocLinkClass(activeId === entry.id)}>
              {entry.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}