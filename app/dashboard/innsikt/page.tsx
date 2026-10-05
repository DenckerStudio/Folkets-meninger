import Link from 'next/link';
import { BarChart3, ExternalLink, Info } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { SurfaceCard } from '@/components/dashboard/surface-card';
import { PageHeader } from '@/components/page-header';
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
    <DashboardPage>
      <PageHeader
        title="Åpen innsikt"
        description="Anonyme stemmetall fra Folkets Stemme. Ingen persondata."
      />
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
        <p>
          Oppdatert {new Date(snapshot.generatedAt).toLocaleString('nb-NO')} · Kun saker med minst{' '}
          {GOVERNMENT_STATS_MIN_VOTES} stemmer
        </p>
      </div>

      <SurfaceCard className="flex gap-3 p-4 text-sm" padded={false}>
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
        <p className="text-muted-foreground">{PUBLIC_STATS_DISCLAIMER}</p>
      </SurfaceCard>

      {snapshot.issues.length === 0 ? (
        <EmptyState
          title="Ingen offentlig statistikk ennå"
          description="Saker vises her når de har nok anonyme stemmer."
        />
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
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-semibold text-foreground pr-4">{issue.title}</h2>
                  <span className="text-xs text-muted-foreground shrink-0">{issue.total} stemmer</span>
                </div>

                <div className="mt-4 h-3 rounded-full overflow-hidden flex bg-muted">
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
                    className="bg-muted-foreground/50"
                    style={{ width: `${abstainPct}%` }}
                    title={`Avstår ${abstainPct}%`}
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>For: {issue.for} ({forPct}%)</span>
                  <span>Mot: {issue.against} ({againstPct}%)</span>
                  <span>Avstår: {issue.abstain} ({abstainPct}%)</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <Link
                    href={routes.sak(issue.stortingetIssueId)}
                    className="text-brand hover:underline"
                  >
                    Se sak →
                  </Link>
                  <a
                    href={issue.stortingetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
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

      <p className="text-sm text-muted-foreground">
        Maskinlesbar data:{' '}
        <a href="/api/public/vote-stats" className="text-brand hover:underline">
          /api/public/vote-stats
        </a>
      </p>
    </DashboardPage>
  );
}
