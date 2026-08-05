import Link from 'next/link';
import PollCard from '@/components/polls/poll-card';
import { listOpenPolls, getPollTotals, getPollTopArguments } from '@/lib/polls/service';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function AvstemningerPage() {
  const polls = await listOpenPolls(40);
  const enriched = await Promise.all(
    polls.map(async (poll) => ({
      poll,
      totals: await getPollTotals(poll.id),
      arguments: await getPollTopArguments(poll.id, 2),
    })),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#00205b]/70">
          Rådgivende folkevilje
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">Avstemninger</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
          Stem Ja, Nei eller Blank på nøytralt saksgrunnlag. Resultatene er anonyme og kan brytes ned
          på fylke. Stortingssporet følger saker fra Stortinget; borgersporet kommer fra
          borgerinitiativ.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href={routes.initiativ} className="font-medium text-indigo-700 hover:underline">
            Se borgerinitiativ
          </Link>
          <Link href={routes.utforsk} className="font-medium text-indigo-700 hover:underline">
            Utforsk Stortingssaker
          </Link>
        </div>
      </header>

      {enriched.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-base font-medium text-gray-900">Ingen åpne avstemninger ennå</p>
          <p className="mt-2 text-sm text-gray-600">
            Start et borgerinitiativ, eller knytt en Stortingssak til avstemningssporet.
          </p>
          <Link
            href={routes.initiativ}
            className="mt-4 inline-flex rounded-lg bg-[#00205b] px-4 py-2 text-sm font-medium text-white hover:bg-[#001a4a]"
          >
            Opprett borgerinitiativ
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {enriched.map(({ poll, totals, arguments: topArgs }) => (
            <PollCard key={poll.id} poll={poll} initialTotals={totals} initialArguments={topArgs} compact />
          ))}
        </div>
      )}
    </div>
  );
}
