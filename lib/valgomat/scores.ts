export type ValgomatPartyScore = {
  party: string;
  agreement_percent: number | null;
  compared_issues: number;
  matching_issues: number;
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

export const PARTY_ALIGNMENT_AVAILABLE = true;

/** Normalizes stance count RPC payload. */
export function stanceCountFromRpc(data: unknown): number {
  if (typeof data === 'number' && Number.isFinite(data)) {
    return Math.max(0, Math.trunc(data));
  }
  return 0;
}