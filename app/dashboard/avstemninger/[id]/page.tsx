import Link from 'next/link';
import { notFound } from 'next/navigation';
import PollCard from '@/components/polls/poll-card';
import PollResultView from '@/components/polls/poll-result-view';
import {
  getPollById,
  getPollTopArguments,
  getPollTotals,
  getPollTotalsByFylke,
} from '@/lib/polls/service';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PollDetailPage({ params }: PageProps) {
  const { id } = await params;
  const poll = await getPollById(id);
  if (!poll || (poll.status !== 'open' && poll.status !== 'closed')) {
    notFound();
  }

  const [totals, byFylke, topArgs] = await Promise.all([
    getPollTotals(poll.id),
    getPollTotalsByFylke(poll.id),
    getPollTopArguments(poll.id, 2),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <Link href={routes.avstemninger} className="text-sm font-medium text-indigo-700 hover:underline">
        ← Alle avstemninger
      </Link>

      <PollCard poll={poll} initialTotals={totals} initialArguments={topArgs} />

      <PollResultView totals={totals} byFylke={byFylke} />
    </div>
  );
}
