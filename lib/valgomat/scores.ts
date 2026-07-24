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

/** Normalizes forum vote history payload to a vote count. */
export function voteCountFromHistory(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.length;
}
