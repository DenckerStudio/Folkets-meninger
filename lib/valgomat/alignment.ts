import type { IssueStance } from '@/lib/stances/types';
import type { PartyStance } from '@/lib/stortinget-votering-rag';
import { PARTY_LABELS } from '@/lib/stortinget-votering-rag';

export const VALGOMAT_MIN_PERCENT_COMPARABLE = 3;
export const VALGOMAT_SMALL_SAMPLE_COMPARABLE = 5;

export type EngagedUserStance = {
  stortinget_issue_id: string;
  title: string | null;
  stance: Exclude<IssueStance, 'ikke_interessert'>;
  updated_at: string;
};

export type PartyIssueComparison = {
  stortinget_issue_id: string;
  title: string | null;
  user_stance: Exclude<IssueStance, 'ikke_interessert'>;
  party_vote: PartyStance;
  aligns: boolean;
  votering_tema: string;
};

export type ValgomatPartySummary = {
  party_code: string;
  party_name: string;
  matching: number;
  comparable: number;
  agreement_percent: number | null;
  small_sample: boolean;
  issues: PartyIssueComparison[];
};

export function userAlignsWithPartyVote(
  userStance: Exclude<IssueStance, 'ikke_interessert'>,
  partyVote: PartyStance,
): boolean {
  if (userStance === 'enig') return partyVote === 'for';
  if (userStance === 'uenig') return partyVote === 'mot';
  return false;
}

export type SakPartyVotesInput = {
  stortinget_issue_id: string;
  votering_tema: string;
  party_stances: Record<string, PartyStance>;
};

export function buildValgomatPartySummaries(
  engagedStances: EngagedUserStance[],
  sakVotes: SakPartyVotesInput[],
): ValgomatPartySummary[] {
  const voteByIssue = new Map(sakVotes.map((v) => [v.stortinget_issue_id, v]));
  const partyBuckets = new Map<string, PartyIssueComparison[]>();

  for (const stance of engagedStances) {
    const votes = voteByIssue.get(stance.stortinget_issue_id);
    if (!votes) continue;

    for (const [partyCode, partyVote] of Object.entries(votes.party_stances)) {
      const aligns = userAlignsWithPartyVote(stance.stance, partyVote);
      const row: PartyIssueComparison = {
        stortinget_issue_id: stance.stortinget_issue_id,
        title: stance.title,
        user_stance: stance.stance,
        party_vote: partyVote,
        aligns,
        votering_tema: votes.votering_tema,
      };
      const list = partyBuckets.get(partyCode) ?? [];
      list.push(row);
      partyBuckets.set(partyCode, list);
    }
  }

  const summaries: ValgomatPartySummary[] = [];

  for (const [partyCode, issues] of partyBuckets.entries()) {
    const comparable = issues.length;
    const matching = issues.filter((i) => i.aligns).length;
    const agreement_percent =
      comparable >= VALGOMAT_MIN_PERCENT_COMPARABLE
        ? Math.round((matching / comparable) * 100)
        : null;

    summaries.push({
      party_code: partyCode,
      party_name: PARTY_LABELS[partyCode] ?? partyCode,
      matching,
      comparable,
      agreement_percent,
      small_sample: comparable < VALGOMAT_SMALL_SAMPLE_COMPARABLE,
      issues: issues.slice().sort((a, b) => b.stortinget_issue_id.localeCompare(a.stortinget_issue_id)),
    });
  }

  return summaries.sort((a, b) => {
    if (b.matching !== a.matching) return b.matching - a.matching;
    const aPct = a.agreement_percent ?? -1;
    const bPct = b.agreement_percent ?? -1;
    if (bPct !== aPct) return bPct - aPct;
    return a.party_name.localeCompare(b.party_name, 'no');
  });
}