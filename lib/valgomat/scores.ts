export type ValgomatPartyScore = {
  party: string;
  agreement_percent: number;
  compared_issues: number;
};

export const VALGOMAT_PARTIES = [
  'Arbeiderpartiet',
  'Høyre',
  'Fremskrittspartiet',
  'Senterpartiet',
  'Sosialistisk Venstreparti',
  'Rødt',
  'Venstre',
  'Kristelig Folkeparti',
  'Miljøpartiet De Grønne',
] as const;

/** Partisammenligning krever stemmedata fra Stortinget per sak — ikke tilgjengelig ennå. */
export const PARTY_ALIGNMENT_AVAILABLE = false;

/** Normalizes `get_user_vote_history` RPC payload to a vote count. */
export function voteCountFromHistoryRpc(data: unknown): number {
  if (Array.isArray(data)) {
    return data.length;
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return 0;
  }
  return 0;
}
