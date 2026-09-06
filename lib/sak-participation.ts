import type { CounterProposalRecord } from '@/lib/counter-proposals/types';

export const SAK_PARTICIPATION_STEPS = ['vote', 'motforslag', 'innspill'] as const;

export type SakParticipationStep = (typeof SAK_PARTICIPATION_STEPS)[number];

export type SakParticipationSummary = {
  proposalCount: number;
  topProposal: Pick<CounterProposalRecord, 'id' | 'title' | 'supportCount' | 'supportThreshold'> | null;
  hearingOpen: boolean;
  hearingTitle: string | null;
  hearingId: string | null;
};

export function buildParticipationSummary(
  proposals: CounterProposalRecord[],
  hearing: { id: string; title: string; open: boolean } | null,
): SakParticipationSummary {
  const top = proposals[0] ?? null;
  return {
    proposalCount: proposals.length,
    topProposal: top
      ? {
          id: top.id,
          title: top.title,
          supportCount: top.supportCount,
          supportThreshold: top.supportThreshold,
        }
      : null,
    hearingOpen: hearing?.open ?? false,
    hearingTitle: hearing?.title ?? null,
    hearingId: hearing?.id ?? null,
  };
}

export function participationStepLabel(step: SakParticipationStep): string {
  switch (step) {
    case 'vote':
      return 'Stem';
    case 'motforslag':
      return 'Motforslag';
    case 'innspill':
      return 'Innspill';
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

export function motforslagCtaForVote(vote: 'for' | 'against' | 'abstain' | null): string {
  switch (vote) {
    case 'against':
      return 'Stemte du mot? Foreslå et alternativ som motforslag.';
    case 'for':
      return 'Du stemte for. Se om andre har foreslått forbedringer, eller frem et eget.';
    case 'abstain':
      return 'Du avstod. Utforsk motforslag eller frem et konkret alternativ.';
    default:
      return 'Utforsk motforslag fra andre borgere, eller frem et eget alternativ.';
  }
}
