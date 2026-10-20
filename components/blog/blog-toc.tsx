'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TocHeading } from '@/lib/blog/markdown-headings';
import { cn } from '@/lib/utils';

type BlogTocProps = {
  headings: TocHeading[];
};

export function BlogToc({ headings }: BlogTocProps) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null);

  const headingIds = useMemo(() => headings.map((heading) => heading.id), [headings]);

  useEffect(() => {
    if (headingIds.length === 0) return undefined;
    const elements = headingIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: [0, 0.2, 1] },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [headingIds]);

  if (headings.length === 0) return null;

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between rounded-xl border border-[#00205b]/10 bg-white px-4 py-3 text-sm font-medium text-[#001433]"
          aria-expanded={open}
        >
          I denne artikkelen ({headings.length})
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        {open ? (
          <ul className="mt-2 space-y-2 rounded-xl border border-[#00205b]/10 bg-white p-4 text-sm">
            {headings.map((heading) => (
              <li key={heading.id} className={heading.level === 3 ? 'pl-3' : undefined}>
                <a
                  href={`#${heading.id}`}
                  className={cn(
                    'text-[#001433]/75 hover:text-[#ba0c2f]',
                    activeId === heading.id && 'font-semibold text-[#00205b]',
                  )}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <nav className="hidden lg:block" aria-label="Innholdsfortegnelse">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#001433]/55">Innhold</p>
        <ul className="mt-3 space-y-2 text-sm">
          {headings.map((heading) => (
            <li key={heading.id} className={heading.level === 3 ? 'pl-3' : undefined}>
              <a
                href={`#${heading.id}`}
                className={cn(
                  'text-[#001433]/75 hover:text-[#ba0c2f]',
                  activeId === heading.id && 'font-semibold text-[#00205b]',
                )}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
