'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, Clock, Filter, MapPin, Search } from 'lucide-react';
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
import { EmptyState } from '@/components/dashboard/empty-state';
import { dashboardControlClass, dashboardSearchClass } from '@/components/dashboard/filter-field';
import { SurfaceCard } from '@/components/dashboard/surface-card';
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

      <SurfaceCard className="mb-6 flex flex-col gap-4 p-4 md:flex-row">
        <div className="relative flex-grow">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk i tittel, dokument eller komité…"
            aria-label="Søk i høringer"
            className={dashboardSearchClass()}
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filtrer på status"
            className={dashboardControlClass()}
          >
            <option>Alle statuser</option>
            <option>Åpen for innspill</option>
            <option>Planlagt</option>
            <option>Avholdt</option>
            <option>Avlyst</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
            <Filter className="h-4 w-4" />
          </div>
        </div>
        <div className="relative">
          <select
            value={committeeFilter}
            onChange={(e) => setCommitteeFilter(e.target.value)}
            aria-label="Filtrer på komité"
            className={dashboardControlClass()}
          >
            {committees.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
            <Filter className="h-4 w-4" />
          </div>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          aria-label="Sorter høringer"
          className={dashboardControlClass('md:w-52')}
        >
          <option value="relevant">Mest relevant</option>
          <option value="frist">Tidligste høring</option>
          <option value="nyeste">Nyeste først</option>
        </select>
      </SurfaceCard>

      <p className="text-sm text-muted-foreground mb-4">
        Viser {filtered.length} av {hearings.length} høringer
      </p>

      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <EmptyState
            title="Ingen høringer matcher filtrene"
            description="Prøv et annet søk, status eller komité."
          />
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
