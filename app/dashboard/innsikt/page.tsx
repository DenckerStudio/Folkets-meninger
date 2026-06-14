import Link from 'next/link';
import { BarChart3, ExternalLink, Info } from 'lucide-react';
import {
  buildGovernmentStatsSnapshot,
  GOVERNMENT_STATS_MIN_VOTES,
  PUBLIC_STATS_DISCLAIMER,
} from '@/lib/government-stats/snapshot';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export default async function InnsiktPage() {
  const snapshot = await buildGovernmentStatsSnapshot({ limit: 80 });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-8 h-8 text-indigo-600" />
          Åpen innsikt
        </h1>
        <p className="text-gray-600 mt-2">
          Anonyme stemmetall fra Folkets Stemme. Ingen persondata eller forumtekst.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-sm text-amber-900">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <p>{PUBLIC_STATS_DISCLAIMER}</p>
      </div>

      <p className="text-xs text-gray-500">
        Oppdatert {new Date(snapshot.generatedAt).toLocaleString('nb-NO')} · Kun saker med minst{' '}
        {GOVERNMENT_STATS_MIN_VOTES} stemmer
      </p>

      {snapshot.issues.length === 0 ? (
        <p className="text-gray-500 text-center py-12 rounded-xl border border-gray-200 bg-gray-50">
          Ingen saker har nok stemmer til å vises offentlig ennå.
        </p>
      ) : (
        <ul className="space-y-4">
          {snapshot.issues.map((issue) => {
            const total = issue.total || 1;
            const forPct = Math.round((issue.for / total) * 100);
            const againstPct = Math.round((issue.against / total) * 100);
            const abstainPct = Math.round((issue.abstain / total) * 100);

            return (
              <li
                key={issue.stortingetIssueId}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-semibold text-gray-900 pr-4">{issue.title}</h2>
                  <span className="text-xs text-gray-500 shrink-0">{issue.total} stemmer</span>
                </div>

                <div className="mt-4 h-3 rounded-full overflow-hidden flex bg-gray-100">
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${forPct}%` }}
                    title={`For ${forPct}%`}
                  />
                  <div
                    className="bg-rose-500"
                    style={{ width: `${againstPct}%` }}
                    title={`Mot ${againstPct}%`}
                  />
                  <div
                    className="bg-gray-400"
                    style={{ width: `${abstainPct}%` }}
                    title={`Avstår ${abstainPct}%`}
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
                  <span>For: {issue.for} ({forPct}%)</span>
                  <span>Mot: {issue.against} ({againstPct}%)</span>
                  <span>Avstår: {issue.abstain} ({abstainPct}%)</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <Link
                    href={routes.sak(issue.stortingetIssueId)}
                    className="text-indigo-600 hover:underline"
                  >
                    Se sak →
                  </Link>
                  <a
                    href={issue.stortingetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
                  >
                    Stortinget
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-gray-500">
        Maskinlesbar data:{' '}
        <a href="/api/public/vote-stats" className="text-indigo-600 hover:underline">
          /api/public/vote-stats
        </a>
      </p>
    </div>
  );
}
