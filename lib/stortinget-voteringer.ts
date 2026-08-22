import { stortingetUrl, type StortingetFormat } from '@/lib/stortinget-utils';
import type { SakVotering } from '@/lib/alignment/types';

type VoteringerResponse = {
  sak_id?: number;
  sak_votering_liste?: SakVotering[] | null;
};

const PROTOCOL_RE = /vedlegges protokollen/i;
const LAW_WHOLE_RE = /lovens overskrift og loven i sin helhet/i;

function asList(raw: SakVotering[] | SakVotering | null | undefined): SakVotering[] {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export function isProtocolVotering(votering: SakVotering): boolean {
  return PROTOCOL_RE.test(votering.votering_tema ?? '');
}

export function isLawWholeVotering(votering: SakVotering): boolean {
  return LAW_WHOLE_RE.test(votering.votering_tema ?? '');
}

export function voteringDecidedCount(votering: SakVotering): number {
  const forCount = votering.antall_for ?? 0;
  const againstCount = votering.antall_mot ?? 0;
  if (forCount < 0 || againstCount < 0) return 0;
  return forCount + againstCount;
}

function voteringTimeMs(votering: SakVotering): number {
  const raw = votering.votering_tid ?? '';
  const match = raw.match(/\/Date\((\d+)/);
  if (match?.[1]) return Number.parseInt(match[1], 10);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rankVotering(votering: SakVotering): number {
  let score = 0;
  if (votering.fri_votering) score += 40;
  if (votering.vedtatt) score += 20;
  if (votering.personlig_votering) score += 10;
  if (voteringDecidedCount(votering) >= 80) score += 8;
  else if (voteringDecidedCount(votering) > 0) score += 4;
  if (isLawWholeVotering(votering)) score -= 25;
  if (isProtocolVotering(votering)) score -= 80;
  score += Math.min(10, Math.floor(voteringTimeMs(votering) / 86_400_000) % 10);
  return score;
}

export function pickPrimaryVotering(voteringer: SakVotering[]): SakVotering | null {
  if (voteringer.length === 0) return null;

  const substantive = voteringer.filter((v) => !isProtocolVotering(v));
  const pool = substantive.length > 0 ? substantive : voteringer;

  const withCounts = pool.filter((v) => voteringDecidedCount(v) > 0);
  const ranked = (withCounts.length > 0 ? withCounts : pool)
    .slice()
    .sort((a, b) => rankVotering(b) - rankVotering(a) || voteringTimeMs(b) - voteringTimeMs(a));

  const top = ranked[0];
  if (!top) return null;

  const altId = top.alternativ_votering_id;
  if (altId && altId > 0) {
    const pair = pool.find((v) => v.votering_id === altId);
    if (pair && top.vedtatt === false && pair.vedtatt === true) {
      return pair;
    }
  }

  return top;
}

export async function fetchSakVoteringer(sakId: string): Promise<SakVotering[]> {
  try {
    const res = await fetch(
      stortingetUrl('/eksport/voteringer', { sakid: sakId, format: 'json' satisfies StortingetFormat }),
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as VoteringerResponse;
    return asList(json.sak_votering_liste).filter((v) => typeof v.votering_id === 'number');
  } catch (error) {
    console.error('[voteringer] Kunne ikke hente Stortingets voteringer:', error);
    return [];
  }
}
