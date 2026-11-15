import Link from 'next/link';
import { BarChart3, ExternalLink, Info } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { SurfaceCard } from '@/components/dashboard/surface-card';
import { PageHeader } from '@/components/page-header';
import {
  buildGovernmentStatsSnapshot,
  PUBLIC_STATS_DISCLAIMER,
} from '@/lib/government-stats/snapshot';
import { MIN_PUBLIC_AGGREGATE_N } from '@/lib/public-aggregate/constants';
import {
  HISTORIC_FOLK_BALLOT_ORDER,
  historicFolkBallotLabel,
  type HistoricFolkBallotSide,
} from '@/lib/public-aggregate/historic-folk-ballot-labels';
import { POLL_BALLOT_RESULT_BAR_CLASS } from '@/lib/polls/ballot-buttons';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const HISTORIC_BAR_CLASS: Record<HistoricFolkBallotSide, string> = {
  against: POLL_BALLOT_RESULT_BAR_CLASS.nei,
  abstain: POLL_BALLOT_RESULT_BAR_CLASS.blank,
  for: POLL_BALLOT_RESULT_BAR_CLASS.ja,
};

function historicCount(issue: { for: number; against: number; abstain: number }, side: HistoricFolkBallotSide) {
  switch (side) {
    case 'for':
      return issue.for;
    case 'against':
      return issue.against;
    case 'abstain':
      return issue.abstain;
    default: {
      const _exhaustive: never = side;
      return _exhaustive;
    }
  }
}

export default async function InnsiktPage() {
  const snapshot = await buildGovernmentStatsSnapshot({ limit: 80 });

  return (
    <DashboardPage>
      <PageHeader
        title="Åpen innsikt"
        description="Historiske anonyme Nei/Blank/Ja-tall fra appen (ikke dagens avstemninger eller holdninger). Ingen persondata."
      />
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
        <p>
          Oppdatert {new Date(snapshot.generatedAt).toLocaleString('nb-NO', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Europe/Oslo',
          })}{' '}
          · Kun saker med minst {MIN_PUBLIC_AGGREGATE_N} stemmer
        </p>
      </div>

      <SurfaceCard className="flex gap-3 p-4 text-sm" padded={false}>
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
        <p className="text-muted-foreground">{PUBLIC_STATS_DISCLAIMER}</p>
      </SurfaceCard>

      {snapshot.issues.length === 0 ? (
        <EmptyState
          title="Ingen offentlig statistikk ennå"
          description={`Saker vises her når de har fått minst ${MIN_PUBLIC_AGGREGATE_N} anonyme stemmer.`}
          action={
            <Link
              href={routes.utforsk}
              className="inline-flex min-h-11 items-center rounded-lg font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Utforsk saker →
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3 sm:space-y-4">
          {snapshot.issues.map((issue) => {
            const total = issue.total || 1;
            const percents = Object.fromEntries(
              HISTORIC_FOLK_BALLOT_ORDER.map((side) => {
                const count = historicCount(issue, side);
                return [side, Math.round((count / total) * 100)] as const;
              }),
            ) as Record<HistoricFolkBallotSide, number>;

            return (
              <li
                key={issue.stortingetIssueId}
                className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-semibold text-foreground pr-4">{issue.title}</h2>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{issue.total} stemmer</span>
                </div>

                <div className="mt-4 h-3 rounded-full overflow-hidden flex bg-muted">
                  {HISTORIC_FOLK_BALLOT_ORDER.map((side) => (
                    <div
                      key={side}
                      className={HISTORIC_BAR_CLASS[side]}
                      style={{ width: `${percents[side]}%` }}
                      title={`${historicFolkBallotLabel(side)} ${percents[side]}%`}
                    />
                  ))}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
                  {HISTORIC_FOLK_BALLOT_ORDER.map((side) => (
                    <span key={side}>
                      {historicFolkBallotLabel(side)}: {historicCount(issue, side)} ({percents[side]}%)
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 text-sm">
                  <Link
                    href={routes.sak(issue.stortingetIssueId)}
                    className="inline-flex min-h-11 items-center font-medium text-brand hover:underline"
                  >
                    Se sak →
                  </Link>
                  <a
                    href={issue.stortingetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 text-muted-foreground hover:text-foreground"
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
        <a href="/api/public/vote-stats" className="inline-flex min-h-11 items-center break-all text-brand hover:underline">
          /api/public/vote-stats
        </a>
      </p>
    </DashboardPage>
  );
}