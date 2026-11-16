import { SakStickyPollLine } from '@/components/sak/sak-sticky-poll-line';
import { getPollTotals, getUserPollVote } from '@/lib/polls/service';
import { redactPollTotalsForViewer } from '@/lib/polls/poll-distribution-reveal';
import { getServerSupabase } from '@/lib/supabase-server';
import type { PollRecord } from '@/lib/polls/types';

type SakOpenPollStickySlotProps = {
  sakId: string;
  openPoll: PollRecord;
};

/** Server-del: henter stemmer og viser fast stemmelinje for åpen avstemning. */
export async function SakOpenPollStickySlot({ sakId, openPoll }: SakOpenPollStickySlotProps) {
  let totals = { ja: 0, nei: 0, blank: 0, total: 0 };
  let totalsLoadError = false;
  try {
    totals = await getPollTotals(openPoll.id);
  } catch {
    totalsLoadError = true;
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const voteState = user
    ? await getUserPollVote(user.id, openPoll.id).catch(() => ({ hasVoted: false, vote: null }))
    : { hasVoted: false, vote: null };

  const viewerTotals = redactPollTotalsForViewer(totals, true, voteState.hasVoted);

  return (
    <SakStickyPollLine
      pollId={openPoll.id}
      sakId={sakId}
      pollTitle={openPoll.title}
      initialTotals={viewerTotals}
      initialVote={voteState.vote}
      totalsLoadError={totalsLoadError}
    />
  );
}