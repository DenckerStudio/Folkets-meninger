'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, Clock, MapPin, Search } from 'lucide-react';
import type { StortingetHoring } from '@/lib/stortinget-horinger';
import {
  formatStortingetDate,
  formatStortingetDateTime,
  getHoringDeadline,
  getHoringTitle,
  isHoringOpen,
  sortHoringer,
} from '@/lib/stortinget-horinger';
import { routes } from '@/lib/routes';

type HoringerListProps = {
  hearings: StortingetHoring[];
};

type SortOption = 'relevant' | 'frist' | 'nyeste';

export default function HoringerList({ hearings }: HoringerListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Alle statuser');
  const [committeeFilter, setCommitteeFilter] = useState('Alle departement/komiteer');
  const [sortBy, setSortBy] = useState<SortOption>('relevant');

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
      const komite = hearing.komite?.navn ?? '';
      const open = isHoringOpen(hearing);

      if (statusFilter === 'Åpen for innspill' && !open) return false;
      if (statusFilter === 'Avholdt' && open) return false;
      if (committeeFilter !== 'Alle departement/komiteer' && komite !== committeeFilter) return false;
      if (q && !title.includes(q) && !komite.toLowerCase().includes(q)) return false;
      return true;
    });

    if (sortBy === 'relevant') return sortHoringer(matched);
    if (sortBy === 'frist') {
      return [...matched].sort((a, b) => {
        const aTime = getHoringDeadline(a)?.getTime() ?? 0;
        const bTime = getHoringDeadline(b)?.getTime() ?? 0;
        return aTime - bTime;
      });
    }
    return [...matched].sort((a, b) => {
      const aStart = getHoringDeadline(a)?.getTime() ?? 0;
      const bStart = getHoringDeadline(b)?.getTime() ?? 0;
      return bStart - aStart;
    });
  }, [hearings, search, statusFilter, committeeFilter, sortBy]);

  return (
    <>
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk i høringer…"
            aria-label="Søk i høringer"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrer på status"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm md:w-auto"
        >
          <option>Alle statuser</option>
          <option>Åpen for innspill</option>
          <option>Avholdt</option>
        </select>
        <select
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          aria-label="Filtrer på komité"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm md:w-auto"
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
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm md:w-auto"
        >
          <option value="relevant">Mest relevant</option>
          <option value="frist">Nærmeste frist</option>
          <option value="nyeste">Nyeste først</option>
        </select>
      </div>

      <p className="text-sm text-gray-500 mb-4">{filtered.length} høringer</p>

      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Ingen høringer matcher filtrene.</div>
        ) : (
          filtered.map((hearing) => {
            const open = isHoringOpen(hearing);
            const komiteNavn = hearing.komite?.navn || 'Ukjent komité';
            const tittel = getHoringTitle(hearing);
            const deadline = getHoringDeadline(hearing);
            const fristText = deadline
              ? deadline.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
              : 'Ukjent frist';
            const nextSession = hearing.horingstidspunkt_liste?.[0];
            const sessionText = nextSession?.tidspunkt
              ? formatStortingetDateTime(nextSession.tidspunkt)
              : formatStortingetDate(hearing.start_dato ?? undefined);
            const sakCount = hearing.horing_sak_info_liste?.length ?? 0;

            return (
              <div
                key={hearing.id}
                className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-all relative overflow-hidden group"
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
                    open ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                />
                <div className="pl-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        open ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {open ? 'Åpen for innspill' : hearing.horing_status || 'Avholdt'}
                    </span>
                    <span className="text-sm text-gray-500">{komiteNavn}</span>
                    {hearing.skriftlig != null && (
                      <span className="text-xs text-gray-400">
                        {hearing.skriftlig ? 'Skriftlig' : 'Muntlig'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[#00205b] mb-2 line-clamp-2">{tittel}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Frist: {fristText}
                    </span>
                    {sessionText && (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {sessionText}
                      </span>
                    )}
                    {nextSession?.sted && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {nextSession.sted}
                      </span>
                    )}
                    {sakCount > 1 && <span>{sakCount} saker</span>}
                  </div>
                  <Link
                    href={routes.horing(String(hearing.id))}
                    className="inline-flex items-center justify-center px-5 py-2.5 border border-gray-200 shadow-sm text-sm font-medium rounded-xl text-[#00205b] bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    {open ? 'Les og gi innspill' : 'Se detaljer'}
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
