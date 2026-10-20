import type { SakVotering } from '@/lib/alignment/types';

/** Infer whether the underlying proposal was adopted from Stortingets kortvedtak. */
export function resolveSakProposalAdopted(kortvedtak: string | null | undefined): boolean | null {
  const text = kortvedtak?.trim();
  if (!text) return null;
  if (/ble\s+ikke\s+vedtatt/i.test(text)) return false;
  if (/ble\s+vedtatt/i.test(text)) return true;
  return null;
}

/** What the Stortinget For/Mot counts refer to in user-facing copy. */
export type StortingetVoteSubject = 'innstilling' | 'forslag' | 'neutral';

export function classifyStortingetVoteSubject(args: {
  kortvedtak?: string | null;
  vedtakstekst?: string | null;
  votering: SakVotering | null;
  hasElectronicCounts: boolean;
}): StortingetVoteSubject {
  const { kortvedtak, vedtakstekst, votering, hasElectronicCounts } = args;
  if (!votering || !hasElectronicCounts) return 'neutral';

  const tema = votering.votering_tema?.trim() ?? '';
  const vedtak = vedtakstekst?.trim() ?? '';
  const proposalAdopted = resolveSakProposalAdopted(kortvedtak);

  if (/innstilling/i.test(tema) || /samsvar\s+med\s+innstillingen/i.test(vedtak)) {
    return 'innstilling';
  }

  if (proposalAdopted === false && votering.vedtatt === true) {
    return 'innstilling';
  }

  if (proposalAdopted === true) {
    return 'forslag';
  }

  if (proposalAdopted === false && votering.vedtatt === false) {
    return 'forslag';
  }

  return 'neutral';
}

export function formatInnstillingVoteTall(stForPercent: number, stAgainstPercent: number): string {
  return `${stForPercent} % stemte for innstillingen, ${stAgainstPercent} % mot`;
}

export function formatForslagVoteTall(stForPercent: number, stAgainstPercent: number): string {
  return `${stForPercent} % stemte for forslaget, ${stAgainstPercent} % mot`;
}

export function formatNeutralVoteTall(stForPercent: number, stAgainstPercent: number): string {
  return `Voteringen ga ${stForPercent} % og ${stAgainstPercent} % på de to sidene`;
}

export const STORTINGET_BAR_LABELS: Record<
  StortingetVoteSubject,
  { for: string; against: string }
> = {
  innstilling: { for: 'For innstillingen', against: 'Mot innstillingen' },
  forslag: { for: 'For forslaget', against: 'Mot forslaget' },
  neutral: { for: 'Den ene siden', against: 'Den andre siden' },
};

export function stortingetVotePhrase(
  subject: StortingetVoteSubject,
  stForPercent: number,
  stAgainstPercent: number,
): string {
  switch (subject) {
    case 'innstilling':
      return formatInnstillingVoteTall(stForPercent, stAgainstPercent);
    case 'forslag':
      return formatForslagVoteTall(stForPercent, stAgainstPercent);
    case 'neutral':
      return formatNeutralVoteTall(stForPercent, stAgainstPercent);
    default: {
      const _exhaustive: never = subject;
      return _exhaustive;
    }
  }
}
