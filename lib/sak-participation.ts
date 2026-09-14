import type { CounterProposalRecord } from '@/lib/counter-proposals/types';
import type { IssueStance } from '@/lib/stances/types';

export const SAK_PARTICIPATION_STEPS = ['stance', 'motforslag', 'innspill'] as const;

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
    case 'stance':
      return 'Holdning';
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

export function motforslagCtaForStance(stance: IssueStance | null): string {
  switch (stance) {
    case 'uenig':
      return 'Uenig? Foreslå et alternativ som motforslag.';
    case 'enig':
      return 'Du er enig. Se om andre har foreslått forbedringer, eller frem et eget.';
    case 'ikke_interessert':
      return 'Ikke interessert i saken? Du kan likevel utforske motforslag fra andre.';
    default:
      return 'Utforsk motforslag fra andre borgere, eller frem et eget alternativ.';
  }
}
