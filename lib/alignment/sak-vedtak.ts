import type { SakVotering } from '@/lib/alignment/types';

export type SakVedtakContext = {
  kortvedtak?: string | null;
  vedtakstekst?: string | null;
};

const INNSTILLING_ONLY_RE = /^(innstilling(en)?|tilråding(en)?)\b/i;
const FORSLAG_RE = /\bforslaget\b/i;
const PROPOSISJON_RE = /\bproposisjonen\b/i;

function sentenceList(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function proposalOutcomeFromSentence(sentence: string): boolean | null {
  const s = sentence.trim();
  if (!s) return null;
  if (INNSTILLING_ONLY_RE.test(s) && !FORSLAG_RE.test(s) && !PROPOSISJON_RE.test(s)) {
    return null;
  }

  if (/\bforslaget\s+ble\s+ikke\s+vedtatt\b/i.test(s)) return false;
  if (/\bproposisjonen\s+ble\s+ikke\s+vedtatt\b/i.test(s)) return false;
  if (/\bforslaget\s+ble\s+vedtatt\b/i.test(s) && !/\bforslaget\s+ble\s+ikke\s+vedtatt\b/i.test(s)) {
    return true;
  }
  if (/\bproposisjonen\s+ble\s+vedtatt\b/i.test(s) && !/\bproposisjonen\s+ble\s+ikke\s+vedtatt\b/i.test(s)) {
    return true;
  }

  return null;
}

function parseProposalAdoptedFromText(text: string | null | undefined): boolean | null {
  const raw = text?.trim();
  if (!raw) return null;

  for (const sentence of sentenceList(raw)) {
    const outcome = proposalOutcomeFromSentence(sentence);
    if (outcome != null) return outcome;
  }

  if (/\bforslaget\s+ble\s+ikke\s+vedtatt\b/i.test(raw)) return false;
  if (/\bproposisjonen\s+ble\s+ikke\s+vedtatt\b/i.test(raw)) return false;
  if (/\bforslaget\s+ble\s+vedtatt\b/i.test(raw) && !/\bforslaget\s+ble\s+ikke\s+vedtatt\b/i.test(raw)) {
    return true;
  }
  if (
    /\bproposisjonen\s+ble\s+vedtatt\b/i.test(raw) &&
    !/\bproposisjonen\s+ble\s+ikke\s+vedtatt\b/i.test(raw)
  ) {
    return true;
  }

  return null;
}

/** Infer whether the underlying proposal was adopted from kortvedtak, else vedtakstekst. */
export function resolveSakProposalAdopted(
  kortvedtak?: string | null,
  vedtakstekst?: string | null,
): boolean | null {
  const fromKort = parseProposalAdoptedFromText(kortvedtak);
  if (fromKort != null) return fromKort;
  return parseProposalAdoptedFromText(vedtakstekst);
}

/** Votering counts are about innstilling (not the proposal) when innstilling passed but forslag did not. */
export function isInnstillingVoteCase(args: {
  kortvedtak?: string | null;
  vedtakstekst?: string | null;
  votering: SakVotering | null;
}): boolean {
  if (!args.votering) return false;
  const proposalAdopted = resolveSakProposalAdopted(args.kortvedtak, args.vedtakstekst);
  return proposalAdopted === false && args.votering.vedtatt === true;
}

/**
 * Stortinget «For»-share to compare with folkets For (proposal support).
 * Invert only for innstillingsvotering when forslaget ikke ble vedtatt.
 */
export function stortingetForShareForFolkAlignment(args: {
  stFor: number;
  stAgainst: number;
  stDecided: number;
  hasElectronicCounts: boolean;
  proposalAdopted: boolean;
  innstillingVote: boolean;
}): number {
  if (!args.hasElectronicCounts || args.stDecided <= 0) {
    return args.proposalAdopted ? 1 : 0;
  }
  const forShare = args.stFor / args.stDecided;
  if (args.innstillingVote) {
    return args.stAgainst / args.stDecided;
  }
  return forShare;
}

export async function fetchSakVedtakContext(issueId: string): Promise<SakVedtakContext> {
  const { getCachedSakDetail } = await import('@/lib/stortinget-detail-cache');
  const detail = await getCachedSakDetail(issueId);
  return {
    kortvedtak: detail?.kortvedtak ?? null,
    vedtakstekst: detail?.vedtakstekst ?? null,
  };
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

  if (/innstilling/i.test(tema) || /samsvar\s+med\s+innstillingen/i.test(vedtak)) {
    return 'innstilling';
  }

  if (isInnstillingVoteCase({ kortvedtak, vedtakstekst, votering })) {
    return 'innstilling';
  }

  const proposalAdopted = resolveSakProposalAdopted(kortvedtak, vedtakstekst);
  if (proposalAdopted === true) return 'forslag';
  if (proposalAdopted === false && votering.vedtatt === false) return 'forslag';

  return 'neutral';
}

export function formatQuotedKortvedtak(kortvedtak: string): string {
  const inner = kortvedtak.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  return `«${inner}»`;
}

export function joinStortingetHeadline(outcomeQuoted: string | null, votePhrase: string): string {
  const vote = votePhrase.trim().replace(/[.!?]+$/, '');
  if (!outcomeQuoted) return `${vote}.`;
  return `${outcomeQuoted} — ${vote}.`;
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
