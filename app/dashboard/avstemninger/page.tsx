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
    'Nasjonale spørsmål med ja, nei eller blank. Se resultatene og delta i avstemninger.',
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
          title="Ingen avstemninger er publisert ennå"
          description="Når en stortingssak løftes til nasjonal avstemning, dukker den opp her. Kom gjerne tilbake senere."
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
