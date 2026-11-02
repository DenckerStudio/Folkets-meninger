import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { PageHeader } from '@/components/page-header';
import { PollCard } from '@/components/polls/poll-card';
import { PollListEmptyState } from '@/components/polls/poll-list-empty-state';
import { getPollTotals, listOpenPolls } from '@/lib/polls/service';
import { pollBallotRunningTextPhrase, pollBallotSlugPhrase } from '@/lib/polls/ballot-buttons';
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
        <PollListEmptyState />
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
