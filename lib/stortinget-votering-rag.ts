import { fetchSakVoteringer } from '@/lib/stortinget-voteringer';

export type PartyStance = 'for' | 'mot';

const PARTY_LABELS: Record<string, string> = {
  A: 'Arbeiderpartiet',
  H: 'Høyre',
  FrP: 'Fremskrittspartiet',
  SV: 'Sosialistisk Venstreparti',
  Sp: 'Senterpartiet',
  R: 'Rødt',
  MDG: 'Miljøpartiet De Grønne',
  KrF: 'Kristelig Folkeparti',
  V: 'Venstre',
};

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

export function formatVoteringRagSummary(
  voteringId: string,
  tema: string,
  stances: Record<string, PartyStance>,
): string {
  const lines = Object.entries(stances).map(([p, s]) => {
    const label = PARTY_LABELS[p] ?? p;
    return `${label} (${p}): ${s}`;
  });
  return [
    `Votering ${voteringId}. ${tema}`,
    'Partiene stemte:',
    ...lines.map((l) => `- ${l}`),
  ].join('\n');
}

export async function fetchVoteringRagSummaryText(
  voteringId: string,
  tema: string,
): Promise<string | null> {
  const url = `https://data.stortinget.no/eksport/voteringsresultat?voteringid=${encodeURIComponent(voteringId)}&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    voteringsresultat_liste?: Array<{ votering?: number; representant?: { parti?: { id?: string } } }>;
  };
  const rows =
    data.voteringsresultat_liste?.map((r) => ({
      partiId: String(r.representant?.parti?.id ?? ''),
      votering: Number(r.votering ?? 0),
    })) ?? [];
  const stances = aggregatePartyStancesFromVoteringRows(rows.filter((r) => r.partiId));
  if (Object.keys(stances).length === 0) return null;
  return formatVoteringRagSummary(voteringId, tema, stances);
}

export async function fetchVoteringRagSummariesForSak(sakId: string): Promise<Array<{ voteringId: string; text: string }>> {
  const voteringer = await fetchSakVoteringer(sakId);
  const out: Array<{ voteringId: string; text: string }> = [];
  for (const v of voteringer) {
    const id = String(v.votering_id);
    const tema = v.votering_tema?.trim() || 'Votering';
    const text = await fetchVoteringRagSummaryText(id, tema);
    if (text) out.push({ voteringId: id, text });
  }
  return out;
}
