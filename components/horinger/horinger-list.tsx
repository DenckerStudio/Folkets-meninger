'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, Clock, MapPin, Search } from 'lucide-react';
import type { StortingetHoring } from '@/lib/stortinget-horinger';
import {
  formatHoringDeadlineSummary,
  formatStortingetDateTime,
  getHoringStartDate,
  getHoringStatusBadgeClass,
  getHoringStatusKind,
  getHoringStatusLabel,
  getHoringSubtitle,
  getHoringTitle,
  isHoringOpen,
  sortHoringer,
  summarizeHoringer,
} from '@/lib/stortinget-horinger';
import { routes } from '@/lib/routes';

type HoringerListProps = {
  hearings: StortingetHoring[];
};

type SortOption = 'relevant' | 'frist' | 'nyeste';
type StatusFilter = 'Alle statuser' | 'Åpen for innspill' | 'Planlagt' | 'Avholdt' | 'Avlyst';

export default function HoringerList({ hearings }: HoringerListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Alle statuser');
  const [committeeFilter, setCommitteeFilter] = useState('Alle departement/komiteer');
  const [sortBy, setSortBy] = useState<SortOption>('relevant');

  const stats = useMemo(() => summarizeHoringer(hearings), [hearings]);

  const committees = useMemo(() => {
    const set = new Set<string>();
    for (const h of hearings) {
      const name = h.komite?.navn;
      if (name) set.add(name);
    }
    return ['Alle departement/komiteer', ...Array.from(set).sort()];
  }, [hearings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = hearings.filter((hearing) => {
      const title = getHoringTitle(hearing).toLowerCase();
      const subtitle = getHoringSubtitle(hearing)?.toLowerCase() ?? '';
      const komite = hearing.komite?.navn ?? '';
      const kind = getHoringStatusKind(hearing);

      if (statusFilter === 'Åpen for innspill' && kind !== 'open') return false;
      if (statusFilter === 'Planlagt' && kind !== 'planned') return false;
      if (statusFilter === 'Avholdt' && kind !== 'held') return false;
      if (statusFilter === 'Avlyst' && kind !== 'cancelled') return false;
      if (committeeFilter !== 'Alle departement/komiteer' && komite !== committeeFilter) return false;
      if (q && !title.includes(q) && !subtitle.includes(q) && !komite.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    if (sortBy === 'relevant') return sortHoringer(matched);
    if (sortBy === 'frist') {
      return [...matched].sort((a, b) => {
        const aTime =
          getHoringStartDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime =
          getHoringStartDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
    }
    return [...matched].sort((a, b) => {
      const aStart = getHoringStartDate(a)?.getTime() ?? 0;
      const bStart = getHoringStartDate(b)?.getTime() ?? 0;
      return bStart - aStart;
    });
  }, [hearings, search, statusFilter, committeeFilter, sortBy]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{stats.open}</p>
          <p className="text-sm text-muted-foreground">Åpne for innspill</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{stats.planned}</p>
          <p className="text-sm text-muted-foreground">Planlagte</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{stats.held}</p>
          <p className="text-sm text-muted-foreground">Avholdte / utløpt</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Totalt i listen</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk i tittel, dokument eller komité…"
            aria-label="Søk i høringer"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filtrer på status"
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground md:w-auto"
        >
          <option>Alle statuser</option>
          <option>Åpen for innspill</option>
          <option>Planlagt</option>
          <option>Avholdt</option>
          <option>Avlyst</option>
        </select>
        <select
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          aria-label="Filtrer på komité"
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground md:w-auto"
        >
          {committees.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          aria-label="Sorter høringer"
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground md:w-auto"
        >
          <option value="relevant">Mest relevant</option>
          <option value="frist">Tidligste høring</option>
          <option value="nyeste">Nyeste først</option>
        </select>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Viser {filtered.length} av {hearings.length} høringer
      </p>

      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-2xl border border-dashed border-border">
            Ingen høringer matcher filtrene.
          </div>
        ) : (
          filtered.map((hearing) => {
            const open = isHoringOpen(hearing);
            const kind = getHoringStatusKind(hearing);
            const komiteNavn = hearing.komite?.navn || 'Ukjent komité';
            const tittel = getHoringTitle(hearing);
            const subtitle = getHoringSubtitle(hearing);
            const deadlineSummary = formatHoringDeadlineSummary(hearing);
            const nextSession = hearing.horingstidspunkt_liste?.[0];
            const sessionText = nextSession?.tidspunkt
              ? formatStortingetDateTime(nextSession.tidspunkt)
              : null;
            const sakCount = hearing.horing_sak_info_liste?.length ?? 0;

            return (
              <div
                key={hearing.id}
                className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all relative overflow-hidden group"
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
                    kind === 'open'
                      ? 'bg-emerald-500'
                      : kind === 'planned'
                        ? 'bg-sky-500'
                        : 'bg-muted-foreground/30'
                  }`}
                />
                <div className="pl-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getHoringStatusBadgeClass(kind)}`}
                    >
                      {getHoringStatusLabel(hearing)}
                    </span>
                    <span className="text-sm text-muted-foreground">{komiteNavn}</span>
                    {hearing.skriftlig != null && (
                      <span className="text-xs text-muted-foreground">
                        {hearing.skriftlig ? 'Skriftlig' : 'Muntlig'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1 line-clamp-2">{tittel}</h3>
                  {subtitle && subtitle !== tittel ? (
                    <p className="text-sm text-muted-foreground mb-3">{subtitle}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4 shrink-0" />
                      {deadlineSummary}
                    </span>
                    {sessionText && (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 shrink-0" />
                        {sessionText}
                      </span>
                    )}
                    {nextSession?.sted && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 shrink-0" />
                        {nextSession.sted}
                      </span>
                    )}
                    {sakCount > 1 && <span>{sakCount} saker</span>}
                  </div>
                  <Link
                    href={routes.horing(String(hearing.id))}
                    className="inline-flex items-center justify-center px-5 py-2.5 border border-border shadow-sm text-sm font-medium rounded-xl text-foreground bg-background hover:bg-muted transition-colors"
                  >
                    {open ? 'Les og gi innspill' : kind === 'planned' ? 'Se planlagt høring' : 'Se detaljer'}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
