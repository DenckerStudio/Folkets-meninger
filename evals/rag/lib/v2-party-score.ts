/** Party vote scoring for voteringer_parti (from retrieved text, not questions.json). */

import type { PartyStance } from '@/lib/stortinget-votering-rag';
import {
  aggregatePartyStancesFromVoteringRows,
  formatVoteringRagSummary,
} from '@/lib/stortinget-votering-rag';

export type { PartyStance };
export { aggregatePartyStancesFromVoteringRows };
export const formatVoteringSummary = formatVoteringRagSummary;

const PARTY_ALIASES: Record<string, string[]> = {
  A: ['arbeiderpartiet', ' arbeider', ' ap '],
  H: ['høyre', 'hoyre', ' h '],
  FrP: ['fremskrittspartiet', 'frp', ' frp '],
  SV: ['sosialistisk venstreparti', ' sv '],
  Sp: ['senterpartiet', ' sp '],
  R: ['rødt', 'rodt', ' rødt '],
  MDG: ['miljøpartiet', 'mdg', ' de grønne'],
  KrF: ['kristelig folkeparti', 'krf', ' krf '],
  V: [' venstre', ' v '],
};

export function scorePartyPositionsInText(
  text: string,
  partyPositions: Record<string, PartyStance>,
  askedParties: string[],
): boolean {
  const hay = text.toLowerCase();
  for (const party of askedParties) {
    const expected = partyPositions[party];
    if (!expected) return false;
    const aliases = [party.toLowerCase(), ...(PARTY_ALIASES[party] ?? [])];
    let found = false;
    for (const alias of aliases) {
      const needle = alias.trim();
      if (needle.length < 2) continue;
      const idx = hay.indexOf(needle);
      if (idx < 0) continue;
      const window = hay.slice(Math.max(0, idx - 60), idx + needle.length + 80);
      const hasFor = /\bfor\b|:\s*for|stemte for|votering[:\s]+1|arbeiderpartiet \(a\): for|høyre \(h\): for/i.test(
        window,
      );
      const hasMot = /\bmot\b|:\s*mot|stemte mot|votering[:\s]+3|arbeiderpartiet \(a\): mot|høyre \(h\): mot/i.test(
        window,
      );
      if (expected === 'for' && hasFor) found = true;
      if (expected === 'mot' && hasMot) found = true;
      if (found) break;
    }
    if (!found) return false;
  }
  return true;
}
