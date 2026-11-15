import { MIN_PUBLIC_AGGREGATE_N } from '@/lib/public-aggregate/constants';
import { largestRemainderPercents } from '@/lib/math/largest-remainder';
import { POLL_BALLOT_BUTTON_ORDER } from '@/lib/polls/ballot-buttons';
import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';
import type { PollChoice, PollTotals } from '@/lib/polls/types';

export function emptyPollTotals(): PollTotals {
  return { ja: 0, nei: 0, blank: 0, total: 0 };
}

/** Hide misleading 100 % bars until enough votes (matches fylke disclosure). */
export const POLL_PUBLIC_PERCENT_MIN_VOTES = MIN_PUBLIC_AGGREGATE_N;

/** Shown when voting is closed (past closes_at or status not open). */
export const POLL_ENDED_USER_MESSAGE = 'Avstemningen er avsluttet';

export function pollBallotPercents(totals: PollTotals): Record<PollChoice, number | null> {
  if (!publicAggregateMeetsThreshold(totals.total)) {
    return { nei: null, blank: null, ja: null };
  }
  const weights = POLL_BALLOT_BUTTON_ORDER.map((choice) => totals[choice]);
  const shares = largestRemainderPercents(weights);
  return {
    nei: shares[0] ?? 0,
    blank: shares[1] ?? 0,
    ja: shares[2] ?? 0,
  };
}

export function pollChoicePercent(totals: PollTotals, choice: PollChoice): number | null {
  return pollBallotPercents(totals)[choice];
}

export function isPollVotingOpen(
  poll: { status: string; opensAt: string | null; closesAt: string | null },
  now = Date.now(),
): boolean {
  if (poll.status !== 'open') return false;
  if (poll.opensAt && new Date(poll.opensAt).getTime() > now) return false;
  if (poll.closesAt && new Date(poll.closesAt).getTime() <= now) return false;
  return true;
}
