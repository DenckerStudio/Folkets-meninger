import Link from 'next/link';
import { PollCard } from '@/components/polls/poll-card';
import { PageHeader } from '@/components/page-header';
import { getPollTotals, listOpenPolls } from '@/lib/polls/service';
import { routes } from '@/lib/routes';

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
        description="Nasjonale spørsmål med Ja, Nei eller Blank — etter sveitsisk modell. Stortingssaker som kildedokumenter ligger under Utforsk."
      />
      <p className="text-sm text-muted-foreground">
        Mangler et spørsmål?{' '}
        <Link href={routes.initiativ} className="font-medium text-brand hover:underline">
          Start et borgerinitiativ
        </Link>
        .
      </p>
      {withTotals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
          Ingen avstemninger er publisert ennå. Når et borgerinitiativ når terskelen, eller en Stortingssak løftes
          til avstemning, vises den her.
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
