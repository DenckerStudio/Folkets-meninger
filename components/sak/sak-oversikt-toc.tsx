'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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

export function SakOversiktToc({ entries, variant }: SakOversiktTocProps) {
  const [open, setOpen] = useState(false);
  const ids = useMemo(() => entries.map((e) => e.id), [entries]);
  const activeId = useActiveSection(ids);

  if (entries.length === 0) return null;

  const linkClass = (id: string) =>
    cn(
      'block rounded-lg px-2 py-1.5 text-[#001433]/75 hover:bg-[#00205b]/5 hover:text-[#ba0c2f]',
      activeId === id && 'bg-[#00205b]/8 font-semibold text-[#00205b]',
    );

  if (variant === 'mobile') {
    return (
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full min-h-11 items-center justify-between rounded-xl border border-[#00205b]/10 bg-card px-4 py-3 text-sm font-medium text-foreground"
          aria-expanded={open}
        >
          Hopp til seksjon
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        {open ? (
          <ul className="mt-2 space-y-1 rounded-xl border border-[#00205b]/10 bg-card p-3 text-sm">
            {entries.map((entry) => (
              <li key={entry.id}>
                <a href={`#${entry.id}`} className={linkClass(entry.id)} onClick={() => setOpen(false)}>
                  {entry.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <nav
      className="sticky top-[calc(4rem+5.5rem+env(safe-area-inset-top,0px))] hidden max-h-[calc(100vh-9rem)] overflow-y-auto lg:block"
      aria-label="Innhold i oversikten"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#001433]/55">På denne siden</p>
      <ul className="mt-3 space-y-1 text-sm">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className={linkClass(entry.id)}>
              {entry.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}