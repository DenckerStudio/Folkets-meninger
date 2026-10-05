import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PollCard } from '@/components/polls/poll-card';
import { PageHeader } from '@/components/page-header';
import { getPollTotals, listOpenPolls } from '@/lib/polls/service';

export const dynamic = 'force-dynamic';

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
        description="Ja, nei eller blank. Saker ligger under Utforsk."
      />
      {withTotals.length === 0 ? (
        <EmptyState
          title="Ingen avstemninger er publisert ennå"
          description="Når en stortingssak løftes til nasjonal avstemning, vises den her."
        />
      ) : (
        <div className="grid gap-4">
          {withTotals.map(({ poll, totals }) => (
            <PollCard key={poll.id} poll={poll} totals={totals} />
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
