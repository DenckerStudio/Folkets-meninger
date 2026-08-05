'use client';

import { motion } from 'motion/react';
import { POLL_FYLKE_MIN_VOTES } from '@/lib/polls/norway-counties';
import { pollChoicePercent } from '@/lib/polls/format';
import type { PollFylkeTotals, PollTotals } from '@/lib/polls/types';
import { cn } from '@/lib/utils';

type PollResultViewProps = {
  totals: PollTotals;
  byFylke: PollFylkeTotals[];
  minVotes?: number;
};

export default function PollResultView({
  totals,
  byFylke,
  minVotes = POLL_FYLKE_MIN_VOTES,
}: PollResultViewProps) {
  const jaPct = pollChoicePercent(totals, 'ja');
  const neiPct = pollChoicePercent(totals, 'nei');
  const blankPct = pollChoicePercent(totals, 'blank');

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Nasjonalt resultat</h3>
        <p className="mt-1 text-sm text-gray-600">
          Rådgivende folkevilje-indikator — {totals.total} anonyme stemmer.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Ja" value={`${jaPct}%`} detail={`${totals.ja} stemmer`} tone="ja" />
          <Stat label="Nei" value={`${neiPct}%`} detail={`${totals.nei} stemmer`} tone="nei" />
          <Stat label="Blank" value={`${blankPct}%`} detail={`${totals.blank} stemmer`} tone="blank" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900">Fylkesfordeling</h3>
        <p className="mt-1 text-sm text-gray-600">
          Resultater per fylke vises først når minst {minVotes} stemmer er avgitt (k-anonymitet).
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Fylke</th>
                <th className="px-4 py-3 font-semibold">Ja</th>
                <th className="px-4 py-3 font-semibold">Nei</th>
                <th className="px-4 py-3 font-semibold">Blank</th>
                <th className="px-4 py-3 font-semibold">Totalt</th>
                <th className="px-4 py-3 font-semibold">Fordeling</th>
              </tr>
            </thead>
            <tbody>
              {byFylke.map((row) => {
                const localTotal = row.sufficientData ? (row.ja ?? 0) + (row.nei ?? 0) + (row.blank ?? 0) : 0;
                const jaShare = localTotal > 0 ? Math.round(((row.ja ?? 0) / localTotal) * 100) : 0;
                const neiShare = localTotal > 0 ? Math.round(((row.nei ?? 0) / localTotal) * 100) : 0;
                const blankShare = localTotal > 0 ? Math.max(0, 100 - jaShare - neiShare) : 0;

                return (
                  <tr key={row.code} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                    {row.sufficientData ? (
                      <>
                        <td className="px-4 py-3 text-emerald-700">{row.ja}</td>
                        <td className="px-4 py-3 text-rose-700">{row.nei}</td>
                        <td className="px-4 py-3 text-slate-600">{row.blank}</td>
                        <td className="px-4 py-3 text-gray-700">{row.total}</td>
                        <td className="px-4 py-3">
                          <div className="flex h-2.5 w-36 overflow-hidden rounded-full bg-gray-100">
                            <motion.div
                              className="bg-emerald-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${jaShare}%` }}
                              transition={{ duration: 0.5 }}
                            />
                            <motion.div
                              className="bg-rose-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${neiShare}%` }}
                              transition={{ duration: 0.5, delay: 0.05 }}
                            />
                            <motion.div
                              className="bg-slate-400"
                              initial={{ width: 0 }}
                              animate={{ width: `${blankShare}%` }}
                              transition={{ duration: 0.5, delay: 0.1 }}
                            />
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-gray-400" colSpan={4}>
                          For få stemmer ({row.total}/{minVotes})
                        </td>
                        <td className="px-4 py-3 text-gray-400">—</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'ja' | 'nei' | 'blank';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        tone === 'ja' && 'border-emerald-200 bg-emerald-50/70',
        tone === 'nei' && 'border-rose-200 bg-rose-50/70',
        tone === 'blank' && 'border-slate-200 bg-slate-50',
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{detail}</p>
    </div>
  );
}
