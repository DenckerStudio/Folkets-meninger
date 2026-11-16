'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { SakSearchHit } from '@/lib/sak/page-search';
import { searchSakPage } from '@/lib/sak/page-search';
import type { OpinionListItem } from '@/lib/opinions/types';
import type { SakDocumentRef } from '@/lib/stortinget-documents';
import { navigateToSakTab } from '@/components/sak/sak-page-tabs';
import { cn } from '@/lib/utils';

const KIND_LABEL: Record<SakSearchHit['kind'], string> = {
  tittel: 'Tittel',
  sammendrag: 'Sammendrag',
  dokument: 'Dokument',
  mening: 'Mening',
  innstilling: 'Innstilling',
  argument: 'Argument',
};

export type SakPageSearchCorpus = {
  title: string;
  summary: string | null;
  documents: readonly Pick<SakDocumentRef, 'id' | 'title'>[];
  opinions: Pick<OpinionListItem, 'id' | 'title' | 'body'>[];
  innstillingSnippet: string | null;
  argumentSnippets: { id: string; text: string; side: 'for' | 'mot' }[];
};

export function SakPageSearch({ corpus, className }: { corpus: SakPageSearchCorpus; className?: string }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(
  () =>
      searchSakPage({
        query,
        title: corpus.title,
        summary: corpus.summary,
        documents: corpus.documents,
        opinions: corpus.opinions,
        innstillingSnippet: corpus.innstillingSnippet,
        argumentSnippets: corpus.argumentSnippets,
      }),
    [corpus, query],
  );

  const scrollToHit = useCallback((hit: SakSearchHit) => {
    navigateToSakTab(hit.tab);
    window.requestAnimationFrame(() => {
      const el = document.getElementById(hit.anchorId);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring-2', 'ring-brand', 'ring-offset-2', 'ring-offset-background');
      window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-brand', 'ring-offset-2', 'ring-offset-background');
      }, 1600);
    });
    setOpen(false);
  }, []);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, []);

  return (
    <div
      ref={rootRef}
      data-sak-page-search=""
      className={cn('relative', className)}
    >
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 shadow-sm">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">Søk i saken</span>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(event.target.value.trim().length >= 2);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (!open || hits.length === 0) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((value) => (value + 1) % hits.length);
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((value) => (value - 1 + hits.length) % hits.length);
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              const hit = hits[activeIndex];
              if (hit) scrollToHit(hit);
            }
            if (event.key === 'Escape') setOpen(false);
          }}
          placeholder="Søk i tittel, sammendrag, dokumenter og meninger …"
          className="min-h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          autoComplete="off"
        />
      </label>

      {open && query.trim().length >= 2 ? (
        <ul className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Ingen treff i saken.</li>
          ) : (
            hits.map((hit, index) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => scrollToHit(hit)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/50',
                    index === activeIndex && 'bg-muted/60',
                  )}
                >
                  <span className="font-medium text-foreground">{hit.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {KIND_LABEL[hit.kind]} · {hit.snippet.slice(0, 120)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}