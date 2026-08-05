'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { SporsmalType } from '@/lib/stortinget';
import {
  formatSporsmalDate,
  formatSporsmalStatus,
  getSporsmalEmner,
  getSporsmalFraNavn,
  getSporsmalTitle,
  isSporsmalBesvart,
  sporsmalTypeLabel,
  type StortingetSporsmal,
} from '@/lib/stortinget-sporsmal';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type SporsmalListProps = {
  sporsmal: StortingetSporsmal[];
  type: SporsmalType;
  sesjonId: string;
};

type AnswerFilter = 'alle' | 'besvart' | 'ubesvart';

export default function SporsmalList({ sporsmal, type, sesjonId }: SporsmalListProps) {
  const [search, setSearch] = useState('');
  const [answerFilter, setAnswerFilter] = useState<AnswerFilter>('alle');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sporsmal.filter((item) => {
      const besvart = isSporsmalBesvart(item);
      if (answerFilter === 'besvart' && !besvart) return false;
      if (answerFilter === 'ubesvart' && besvart) return false;

      if (!q) return true;
      const title = getSporsmalTitle(item).toLowerCase();
      const fra = (getSporsmalFraNavn(item) ?? '').toLowerCase();
      const minister = (item.sporsmal_til_minister_tittel ?? '').toLowerCase();
      const emner = getSporsmalEmner(item).join(' ').toLowerCase();
      return title.includes(q) || fra.includes(q) || minister.includes(q) || emner.includes(q);
    });
  }, [sporsmal, search, answerFilter]);

  const typeHref = (nextType: SporsmalType) => {
    const params = new URLSearchParams({ type: nextType, sesjonId });
    return `${routes.sporsmal}?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(['skriftligesporsmal', 'sporretimesporsmal', 'interpellasjoner'] as SporsmalType[]).map((t) => (
          <Link
            key={t}
            href={typeHref(t)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold border transition-colors',
              t === type
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-card text-foreground border-border hover:bg-muted/50',
            )}
          >
            {sporsmalTypeLabel(t)}
          </Link>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk i tittel, politiker, minister eller emne…"
            aria-label="Søk i spørsmål"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={answerFilter}
          onChange={(e) => setAnswerFilter(e.target.value as AnswerFilter)}
          aria-label="Filtrer på svarstatus"
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm md:w-auto"
        >
          <option value="alle">Alle</option>
          <option value="besvart">Besvart</option>
          <option value="ubesvart">Ubesvart</option>
        </select>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border text-sm text-muted-foreground">
          {filtered.length} av {sporsmal.length} spørsmål
        </div>
        <div className="divide-y divide-border">
          {filtered.slice(0, 200).map((item, idx) => {
            const title = getSporsmalTitle(item);
            const sendt = formatSporsmalDate(item.sendt_dato) ?? formatSporsmalDate(item.datert_dato);
            const statusLabel = formatSporsmalStatus(item.status);
            const fraNavn = getSporsmalFraNavn(item);
            const minister = item.sporsmal_til_minister_tittel;
            const emner = getSporsmalEmner(item).slice(0, 3);
            const besvart = isSporsmalBesvart(item);

            return (
              <div key={String(item.id ?? idx)} className="px-6 py-4 hover:bg-muted/50 transition-colors">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {item.sporsmal_nummer != null && (
                    <span className="text-xs font-medium text-muted-foreground">#{item.sporsmal_nummer}</span>
                  )}
                  <span
                    className={cn(
                      'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
                      besvart ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-800',
                    )}
                  >
                    {besvart ? 'Besvart' : 'Ubesvart'}
                  </span>
                  {statusLabel && <span className="text-xs text-muted-foreground">{statusLabel}</span>}
                </div>
                {item.id ? (
                  <Link
                    href={routes.sporsmalDetail(String(item.id))}
                    className="text-sm font-semibold text-foreground hover:text-indigo-600 dark:text-indigo-400 line-clamp-2"
                  >
                    {title}
                  </Link>
                ) : (
                  <div className="text-sm font-semibold text-foreground line-clamp-2">{title}</div>
                )}
                <div className="mt-1.5 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                  {fraNavn && <span>Fra {fraNavn}</span>}
                  {minister && <span>Til {minister}</span>}
                  {sendt && <span>{sendt}</span>}
                </div>
                {emner.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {emner.map((emne) => (
                      <span
                        key={emne}
                        className="inline-flex px-2 py-0.5 rounded-md bg-muted text-xs text-muted-foreground"
                      >
                        {emne}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length > 200 && (
            <div className="px-6 py-4 text-xs text-muted-foreground">Viser første 200 treff. Bruk søk for å finne flere.</div>
          )}
          {filtered.length === 0 && (
            <div className="px-6 py-10 text-sm text-muted-foreground text-center">Ingen spørsmål matcher filtrene.</div>
          )}
        </div>
      </div>
    </div>
  );
}
