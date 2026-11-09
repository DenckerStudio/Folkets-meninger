import Link from 'next/link';
import { PollBallot } from '@/components/polls/poll-ballot';
import {
  getPollTotals,
  getPublicPollById,
  getUserPollVote,
  isPollVotingOpen,
} from '@/lib/polls/service';
import { pollBallotRunningTextPhraseSentenceStart } from '@/lib/polls/ballot-buttons';
import { getServerSupabase } from '@/lib/supabase-server';
import { routes } from '@/lib/routes';

type PublicResearchTopicPollPanelProps = {
  pollId: string;
  topicPath: string;
};

export async function PublicResearchTopicPollPanel({
  pollId,
  topicPath,
}: PublicResearchTopicPollPanelProps) {
  const poll = await getPublicPollById(pollId);
  if (!poll) {
    return (
      <section className="rounded-2xl border border-dashed border-[#00205b]/15 bg-[#00205b]/[0.02] p-5 text-sm text-[#001433]/65">
        Avstemningen er ikke tilgjengelig akkurat nå.
      </section>
    );
  }

  const votingOpen = isPollVotingOpen(poll);
  const totals = await getPollTotals(poll.id).catch(() => ({
    ja: 0,
    nei: 0,
    blank: 0,
    total: 0,
  }));

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const voteState = user
    ? await getUserPollVote(user.id, poll.id).catch(() => ({ hasVoted: false, vote: null }))
    : { hasVoted: false, vote: null };

  return (
    <section className="space-y-4 rounded-2xl border border-[#00205b]/10 bg-white p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[#001433]">Si din mening</h2>
        <p className="text-sm text-[#001433]/65">
          {pollBallotRunningTextPhraseSentenceStart()} på denne avstemningen.
        </p>
      </div>
      <PollBallot
        pollId={poll.id}
        votingOpen={votingOpen}
        initialTotals={totals}
        initialVote={voteState.vote}
        loginNext={topicPath}
        compact
      />
      <p className="text-sm">
        <Link
          href={routes.poll(poll.id)}
          className="font-semibold text-[#00205b] hover:text-[#ba0c2f] hover:underline"
        >
          Åpne avstemningen på egen side
        </Link>
      </p>
    </section>
  );
}
