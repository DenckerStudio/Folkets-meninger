import { buildAlignmentComparison } from '@/lib/alignment/score';
import type { SakVedtakContext } from '@/lib/alignment/sak-vedtak';
import type { FolkVoteCounts, SakVotering } from '@/lib/alignment/types';
import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';
import { pollDistributionRevealAllowed } from '@/lib/polls/poll-distribution-reveal';
import type { PollTotals } from '@/lib/polls/types';
import { routes } from '@/lib/routes';

export type SakFolkVsStortingetViewModel = {
  emptyMessage: string | null;
  headline: string | null;
  summary: string | null;
  stortingetForPercent: number | null;
  stortingetAgainstPercent: number | null;
  stortingetBarFor: string;
  stortingetBarAgainst: string;
  stortingetAbsentLabel: string | null;
  voteringTema: string | null;
  folkKind: 'poll' | 'historic' | 'none';
  pollTotals: PollTotals | null;
  pollPercents: { ja: number; nei: number; blank: number } | null;
  showFolkDistribution: boolean;
  folkHiddenMessage: string | null;
  historicFolk: FolkVoteCounts;
  historicForPercent: number;
  historicAgainstPercent: number;
  historicAbstainPercent: number;
  votingOpen: boolean;
  pollHref: string | null;
};

function pollPercents(totals: PollTotals) {
  const total = totals.total;
  if (total <= 0) return { ja: 0, nei: 0, blank: 0 };
  return {
    ja: Math.round((totals.ja / total) * 100),
    nei: Math.round((totals.nei / total) * 100),
    blank: Math.round((totals.blank / total) * 100),
  };
}

export function buildSakFolkVsStortingetView(args: {
  folk: FolkVoteCounts;
  voteringer: readonly SakVotering[];
  sakVedtak: SakVedtakContext;
  poll?: {
    id: string;
    totals: PollTotals;
    votingOpen: boolean;
    hasVoted: boolean;
  } | null;
}): SakFolkVsStortingetViewModel {
  const comparison = buildAlignmentComparison(args.folk, [...args.voteringer], args.sakVedtak);
  const poll = args.poll ?? null;

  const showPollDistribution =
    poll != null && pollDistributionRevealAllowed(poll.votingOpen, poll.hasVoted, poll.totals);

  const historicPublic = !poll && publicAggregateMeetsThreshold(comparison.folk.total);

  let folkHiddenMessage: string | null = null;
  if (poll) {
    if (poll.votingOpen && !poll.hasVoted) {
      folkHiddenMessage = 'Fordelingen fra avstemningen vises når du har stemt.';
    } else if (!publicAggregateMeetsThreshold(poll.totals.total)) {
      folkHiddenMessage = 'Fordelingen vises når minst 5 har stemt.';
    }
  }

  const hasStorting =
    comparison.stortinget != null &&
    comparison.stortingetForPercent != null &&
    comparison.stortingetAgainstPercent != null;
  const hasFolkSignal = showPollDistribution || historicPublic;
  const hideFolkInHeadline = poll != null && !showPollDistribution;
  const stOnlyComparison = hideFolkInHeadline
    ? buildAlignmentComparison({ for: 0, against: 0, abstain: 0, total: 0 }, [...args.voteringer], args.sakVedtak)
  : null;

  const emptyMessage =
    !hasStorting && !hasFolkSignal && !poll
      ? 'Ingen Stortinget-votering eller nok stemmer i appen er tilgjengelig for sammenligning ennå.'
      : null;

  return {
    emptyMessage,
    headline: stOnlyComparison?.headline ?? comparison.headline,
    summary: stOnlyComparison?.summary ?? comparison.summary,
    stortingetForPercent: comparison.stortingetForPercent,
    stortingetAgainstPercent: comparison.stortingetAgainstPercent,
    stortingetBarFor: comparison.stortingetBarLabels.for,
    stortingetBarAgainst: comparison.stortingetBarLabels.against,
    stortingetAbsentLabel:
      comparison.stortinget && comparison.stortinget.absent > 0
        ? `${comparison.stortinget.absent} ikke til stede`
        : null,
    voteringTema: comparison.votering?.votering_tema ?? null,
    folkKind: showPollDistribution ? 'poll' : historicPublic ? 'historic' : 'none',
    pollTotals: poll?.totals ?? null,
    pollPercents: poll && showPollDistribution ? pollPercents(poll.totals) : null,
    showFolkDistribution: showPollDistribution || historicPublic,
    folkHiddenMessage,
    historicFolk: comparison.folk,
    historicForPercent: comparison.folkForPercent,
    historicAgainstPercent: comparison.folkAgainstPercent,
    historicAbstainPercent: comparison.folkAbstainPercent,
    votingOpen: poll?.votingOpen ?? false,
    pollHref: poll ? routes.poll(poll.id) : null,
  };
}