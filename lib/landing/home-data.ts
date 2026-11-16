import { redactPublicFolkChoiceFields } from '@/lib/public-aggregate/folk-public-output';
import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';
import { getPollTotals, isPollVotingOpen, listOpenPolls } from '@/lib/polls/service';
import type { PollRecord } from '@/lib/polls/types';
import { listPublicResearchTopics } from '@/lib/research-topics/public-service';
import type { PublicResearchTopicListItem } from '@/lib/research-topics/public-map';
import { getPopularSaker } from '@/lib/stortinget-saker-cache';
import type { LandingIssue } from '@/components/landing-popular-issues';
import { formatLandingPollDeadline } from '@/lib/landing/display-time';

export type LandingOpenPollsSnapshot = {
  openCount: number;
  nearestClosesAt: string | null;
  nearestDeadlineLabel: string | null;
  /** Sum of votes on open polls — only set when total ≥ MIN_PUBLIC_AGGREGATE_N. */
  publicVoteCount: number | null;
};

export function computeLandingOpenPollsSnapshot(
  openPolls: PollRecord[],
  totalsByPollId: Record<string, number>,
  now = Date.now(),
): LandingOpenPollsSnapshot {
  if (!openPolls.length) {
    return {
      openCount: 0,
      nearestClosesAt: null,
      nearestDeadlineLabel: null,
      publicVoteCount: null,
    };
  }

  let nearestClosesAt: string | null = null;
  let nearestMs = Infinity;
  for (const poll of openPolls) {
    if (!poll.closesAt) continue;
    const ms = new Date(poll.closesAt).getTime();
    if (ms > now && ms < nearestMs) {
      nearestMs = ms;
      nearestClosesAt = poll.closesAt;
    }
  }

  const voteSum = openPolls.reduce((acc, poll) => acc + (totalsByPollId[poll.id] ?? 0), 0);
  const publicVoteCount = publicAggregateMeetsThreshold(voteSum) ? voteSum : null;

  return {
    openCount: openPolls.length,
    nearestClosesAt,
    nearestDeadlineLabel: nearestClosesAt ? formatLandingPollDeadline(nearestClosesAt, now) : null,
    publicVoteCount,
  };
}

export async function fetchLandingOpenPollsSnapshot(): Promise<LandingOpenPollsSnapshot | null> {
  try {
    // Nyeste 40 rader (open+closed i kilden); filtreres til faktisk åpne. Teller capes ved høyt volum.
    const polls = await listOpenPolls(40);
    const openPolls = polls.filter((poll) => isPollVotingOpen(poll));
    const totalsEntries = await Promise.all(
      openPolls.map(async (poll) => {
        const totals = await getPollTotals(poll.id);
        return [poll.id, totals.total] as const;
      }),
    );
    const totalsByPollId = Object.fromEntries(totalsEntries) as Record<string, number>;
    return computeLandingOpenPollsSnapshot(openPolls, totalsByPollId);
  } catch (error) {
    console.error('[landing] fetchLandingOpenPollsSnapshot failed', error);
    return null;
  }
}

export async function fetchLandingResearchTopics(
  limit = 3,
): Promise<{ topics: PublicResearchTopicListItem[]; failed: boolean }> {
  try {
    const topics = await listPublicResearchTopics(limit);
    return { topics, failed: false };
  } catch (error) {
    console.error('[landing] fetchLandingResearchTopics failed', error);
    return { topics: [], failed: true };
  }
}

function mapPopularSakerToLandingIssues(limit: number): Promise<LandingIssue[]> {
  return getPopularSaker(limit).then((popular) =>
    popular.map((issue) => ({
      id: issue.id,
      title: issue.title,
      summary: issue.summary,
      category: issue.category,
      date: issue.date,
      votes: redactPublicFolkChoiceFields({
        for: issue.votes.for,
        against: issue.votes.against,
        abstain: issue.votes.abstain,
        total: issue.votes.total,
      }),
    })),
  );
}

export async function fetchLandingPopularIssues(
  limit = 6,
): Promise<{ issues: LandingIssue[]; failed: boolean }> {
  try {
    const issues = await mapPopularSakerToLandingIssues(limit);
    return { issues, failed: false };
  } catch (error) {
    console.error('[landing] fetchLandingPopularIssues failed', error);
    return { issues: [], failed: true };
  }
}