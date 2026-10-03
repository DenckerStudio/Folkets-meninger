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
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Avstemninger"
        description="Ja, nei eller blank. Saker ligger under Utforsk."
      />
      {withTotals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
          Ingen avstemninger er publisert ennå. Når en Stortingssak løftes til nasjonal avstemning, vises den her.
        </div>
      ) : (
        <div className="grid gap-4">
          {withTotals.map(({ poll, totals }) => (
            <PollCard key={poll.id} poll={poll} totals={totals} />
          ))}
        </div>
      )}
    </div>
  );
}
