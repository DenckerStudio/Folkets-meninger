import { buildSakFolkVsStortingetView } from '@/lib/sak/folk-vs-stortinget-view';
import type { FolkVoteCounts, SakVotering } from '@/lib/alignment/types';
import type { SakVedtakContext } from '@/lib/alignment/sak-vedtak';
import { isPollVotingOpen } from '@/lib/polls/format';
import { findPublicPollForIssue, getPollTotals, getUserPollVote } from '@/lib/polls/service';
import { getServerSupabase } from '@/lib/supabase-server';
import { SakFolketsViljeVsStortinget } from '@/components/sak/sak-folkets-vilje-vs-stortinget';

export async function SakFolketsViljeVsStortingetSection({
  sakId,
  voteringer,
  initialFolk,
  sakVedtak,
}: {
  sakId: string;
  voteringer: readonly SakVotering[];
  initialFolk: FolkVoteCounts;
  sakVedtak: SakVedtakContext;
}) {
  let pollBundle: {
    id: string;
    totals: Awaited<ReturnType<typeof getPollTotals>>;
    votingOpen: boolean;
    hasVoted: boolean;
  } | null = null;

  try {
    const poll = await findPublicPollForIssue(sakId);
    if (poll) {
      const totals = await getPollTotals(poll.id);
      const votingOpen = isPollVotingOpen(poll);
      const supabase = await getServerSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const voteState = user
        ? await getUserPollVote(user.id, poll.id).catch(() => ({ hasVoted: false, vote: null }))
        : { hasVoted: false, vote: null };
      pollBundle = {
        id: poll.id,
        totals,
        votingOpen,
        hasVoted: voteState.hasVoted,
      };
    }
  } catch {
    pollBundle = null;
  }

  const model = buildSakFolkVsStortingetView({
    folk: initialFolk,
    voteringer,
    sakVedtak,
    poll: pollBundle,
  });

  return <SakFolketsViljeVsStortinget sakId={sakId} model={model} />;
}