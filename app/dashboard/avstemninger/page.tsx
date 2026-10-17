import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PollCard } from '@/components/polls/poll-card';
import { PageHeader } from '@/components/page-header';
import { getPollTotals, listOpenPolls } from '@/lib/polls/service';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Avstemninger',
  description:
    'Spørsmål for hele landet der du svarer ja, nei eller blank. Se hva andre brukere har svart.',
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
        description="Si ja, nei eller stem blankt på nasjonale spørsmål. Enkeltsaker fra Stortinget finner du under Utforsk."
      />
      {withTotals.length === 0 ? (
        <EmptyState
          title="Ingen avstemninger ennå"
          description="Når vi lager en avstemning om en sak fra Stortinget, kommer den her."
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
