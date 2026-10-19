/** Party vote scoring for voteringer_parti (from retrieved text, not questions.json). */

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

export type PartyStance = 'for' | 'mot';

export function aggregatePartyStancesFromVoteringRows(
  rows: Array<{ partiId: string; votering: number }>,
): Record<string, PartyStance> {
  const counts: Record<string, { for: number; mot: number }> = {};
  for (const row of rows) {
    const p = row.partiId;
    if (!counts[p]) counts[p] = { for: 0, mot: 0 };
    if (row.votering === 1) counts[p].for += 1;
    else if (row.votering === 3) counts[p].mot += 1;
  }
  const out: Record<string, PartyStance> = {};
  for (const [p, c] of Object.entries(counts)) {
    if (c.for === 0 && c.mot === 0) continue;
    out[p] = c.mot >= c.for ? 'mot' : 'for';
  }
  return out;
}

export function formatVoteringSummary(
  voteringId: string,
  tema: string,
  stances: Record<string, PartyStance>,
): string {
  const lines = Object.entries(stances).map(([p, s]) => `${p}: ${s}`);
  return `Votering ${voteringId}. ${tema}\nPartiene stemte: ${lines.join(', ')}.`;
}

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
      const hasFor = /\bfor\b|:\s*for|stemte for|votering[:\s]+1/.test(window);
      const hasMot = /\bmot\b|:\s*mot|stemte mot|votering[:\s]+3/.test(window);
      if (expected === 'for' && hasFor) found = true;
      if (expected === 'mot' && hasMot) found = true;
      if (found) break;
    }
    if (!found) return false;
  }
  return true;
}
