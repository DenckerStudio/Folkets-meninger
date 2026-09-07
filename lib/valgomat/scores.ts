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

/** Normalizes stance count RPC payload. */
export function stanceCountFromRpc(data: unknown): number {
  if (typeof data === 'number' && Number.isFinite(data)) {
    return Math.max(0, Math.trunc(data));
  }
  return 0;
}

/** @deprecated Use stanceCountFromRpc — kept for legacy tests. */
export function voteCountFromHistoryRpc(data: unknown): number {
  if (Array.isArray(data)) {
    return data.length;
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return 0;
  }
  return 0;
}
