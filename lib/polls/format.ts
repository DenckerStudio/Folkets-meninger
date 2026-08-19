import type { PollChoice, PollTotals } from '@/lib/polls/types';

export function emptyPollTotals(): PollTotals {
  return { ja: 0, nei: 0, blank: 0, total: 0 };
}

export function pollChoicePercent(totals: PollTotals, choice: PollChoice): number {
  if (totals.total <= 0) return 0;
  return Math.round((totals[choice] / totals.total) * 100);
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
