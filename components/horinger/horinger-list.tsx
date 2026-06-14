'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, Search } from 'lucide-react';
import type { StortingetHoring } from '@/lib/stortinget-horinger';
import { getHoringDeadline, getHoringTitle } from '@/lib/stortinget-horinger';
import { routes } from '@/lib/routes';

type HoringerListProps = {
  hearings: StortingetHoring[];
};

export default function HoringerList({ hearings }: HoringerListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Alle statuser');
  const [committeeFilter, setCommitteeFilter] = useState('Alle departement/komiteer');

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
    return hearings.filter((hearing) => {
      const title = getHoringTitle(hearing).toLowerCase();
      const komite = hearing.komite?.navn ?? '';
      const isAvholdt = hearing.horing_status === 'Avholdt';

      if (statusFilter === 'Åpen for innspill' && isAvholdt) return false;
      if (statusFilter === 'Under behandling' && isAvholdt) return false;
      if (statusFilter === 'Avholdt' && !isAvholdt) return false;
      if (committeeFilter !== 'Alle departement/komiteer' && komite !== committeeFilter) return false;
      if (q && !title.includes(q) && !komite.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [hearings, search, statusFilter, committeeFilter]);

  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk i høringer..."
            aria-label="Søk i høringer"
            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrer på status"
          className="block w-full md:w-auto pl-3 pr-10 py-3 text-base border-gray-200 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-xl border bg-white"
        >
          <option>Alle statuser</option>
          <option>Åpen for innspill</option>
          <option>Under behandling</option>
          <option>Avholdt</option>
        </select>
        <select
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          aria-label="Filtrer på komité"
          className="block w-full md:w-auto pl-3 pr-10 py-3 text-base border-gray-200 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-xl border bg-white"
        >
          {committees.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Ingen høringer matcher filtrene.</div>
        ) : (
          filtered.map((hearing) => {
            const isAvholdt = hearing.horing_status === 'Avholdt';
            const komiteNavn = hearing.komite?.navn || 'Ukjent komité';
            const tittel = getHoringTitle(hearing);
            const deadline = getHoringDeadline(hearing);
            const fristText = deadline
              ? deadline.toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })
              : 'Ukjent frist';

            return (
              <div
                key={hearing.id}
                className="bg-white border text-left border-gray-100 rounded-2xl p-6 hover:shadow-md transition-all duration-200 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden group"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 group-hover:bg-[#ba0c2f] transition-colors" />
                <div className="flex-1 pl-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        !isAvholdt ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {hearing.horing_status || 'Ukjent status'}
                    </span>
                    <span className="text-sm font-medium text-gray-500">{komiteNavn}</span>
                  </div>
                  <h3 className="text-xl font-bold text-[#00205b] mb-2">{tittel}</h3>
                  <div className="flex items-center text-sm text-gray-500 mb-4 md:mb-0 space-x-6">
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1.5" />
                      Frist: {fristText}
                    </span>
                  </div>
                </div>
                <div className="mt-4 md:mt-0 w-full md:w-auto flex justify-end pl-4">
                  <Link
                    href={routes.horing(String(hearing.id))}
                    className="inline-flex items-center justify-center px-6 py-3 border border-gray-200 shadow-sm text-sm font-medium rounded-xl text-[#00205b] bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors w-full md:w-auto"
                  >
                    Les og gi innspill
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
