import type { PartyStance } from '@/lib/stortinget-votering-rag';
import type { PollRecord } from '@/lib/polls/types';
import type { PublicPollTotals } from '@/lib/public-aggregate/poll-public-output';

export type RepresentantStortingetVote = 'for' | 'mot' | 'ikke_tilstede';

export type PolitikerStemmerRow = {
  issueId: string;
  sakTitle: string;
  sakHref: string;
  voteringId: string;
  voteringTema: string;
  votedAtIso: string | null;
  votedAtLabel: string | null;
  representantVote: RepresentantStortingetVote;
  partyLine: PartyStance | null;
  votedAgainstParty: boolean;
  poll: PollRecord | null;
  pollTotalsPublic: PublicPollTotals | null;
  pollFylkeTotalsPublic: PublicPollTotals | null;
  pollFylkeName: string | null;
  pollOpen: boolean;
  pollHref: string | null;
  comparableWithUsers: boolean;
  alignsWithUsers: boolean;
};

export type PolitikerStemmerSummary =
  | { kind: 'neutral'; message: string }
  | { kind: 'stats'; alignedCount: number; comparableCount: number; message: string };

export type PolitikerStemmerBundle = {
  status: 'ok' | 'error' | 'empty';
  summary: PolitikerStemmerSummary;
  rows: PolitikerStemmerRow[];
  errorMessage?: string;
};

export function parseStortingetRepresentantVoteCode(code: number): RepresentantStortingetVote {
  if (code === 1) return 'for';
  if (code === 3) return 'mot';
  return 'ikke_tilstede';
}

export function representativeVotedAgainstParty(
  representantVote: RepresentantStortingetVote,
  partyLine: PartyStance | null,
): boolean {
  if (representantVote === 'ikke_tilstede' || !partyLine) return false;
  return (
    (representantVote === 'for' && partyLine === 'mot') ||
    (representantVote === 'mot' && partyLine === 'for')
  );
}

export function representativeAlignsWithPollUsers(
  representantVote: Exclude<RepresentantStortingetVote, 'ikke_tilstede'>,
  majority: 'ja' | 'nei',
): boolean {
  return (
    (representantVote === 'for' && majority === 'ja') ||
    (representantVote === 'mot' && majority === 'nei')
  );
}

export function buildPolitikerStemmerSummary(rows: PolitikerStemmerRow[]): PolitikerStemmerSummary {
  const comparable = rows.filter((row) => row.comparableWithUsers);
  if (comparable.length === 0) {
    return {
      kind: 'neutral',
      message:
        'Her sammenligner vi Stortingets stemmer med anonyme Nei/Blank/Ja-avstemninger på saker der det finnes nok svar.',
    };
  }
  const alignedCount = comparable.filter((row) => row.alignsWithUsers).length;
  const comparableCount = comparable.length;
  const sakLabel = comparableCount === 1 ? 'sak' : 'saker';
  return {
    kind: 'stats',
    alignedCount,
    comparableCount,
    message: `Stemte i tråd med flertallet blant brukerne i ${alignedCount} av ${comparableCount} ${sakLabel}.`,
  };
}

export function formatRepresentantStortingetVoteLabel(vote: RepresentantStortingetVote): string {
  switch (vote) {
    case 'for':
      return 'For';
    case 'mot':
      return 'Mot';
    case 'ikke_tilstede':
      return 'Ikke til stede';
    default: {
      const _exhaustive: never = vote;
      return _exhaustive;
    }
  }
}

export function formatPartyLineLabel(line: PartyStance | null): string {
  if (!line) return 'Ukjent';
  return line === 'for' ? 'Partiet stemte for' : 'Partiet stemte mot';
}