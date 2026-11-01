import Link from 'next/link';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PollCard } from '@/components/polls/poll-card';
import { PageHeader } from '@/components/page-header';
import { getPollTotals, listOpenPolls } from '@/lib/polls/service';
import { pollBallotRunningTextPhrase, pollBallotSlugPhrase } from '@/lib/polls/ballot-buttons';
import { routes } from '@/lib/routes';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Avstemninger',
  description:
    `Nasjonale spørsmål med ${pollBallotRunningTextPhrase()}. Se resultatene og delta i avstemninger.`,
  canonicalPath: '/dashboard/avstemninger',
});

export default async function AvstemningerPage() {
  const polls = await listOpenPolls(40);
  const withTotals = await Promise.all(
    polls.map(async (poll) => ({
      poll,
      totals: await getPollTotals(poll.id),
    })),
  );

  return (
    <DashboardPage>
      <PageHeader
        title="Avstemninger"
        description={`Nasjonale ${pollBallotSlugPhrase()}-avstemninger som løftes fra Folkets meninger når en mening får nok popularitet.`}
      />
      {withTotals.length === 0 ? (
        <EmptyState
          title="Ingen avstemninger er publisert ennå"
          description="Når en mening i Folkets meninger får nok popularitet, kan den løftes til avstemning her. Skriv og støtt meninger du bryr deg om."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={routes.folketsMeninger}
                className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90"
              >
                Gå til Folkets meninger
              </Link>
              <Link
                href={routes.utforsk}
                className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
              >
                Utforsk
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {withTotals.map(({ poll, totals }) => (
            <PollCard key={poll.id} poll={poll} totals={totals} />
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
