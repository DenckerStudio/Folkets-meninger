import { ALIGNMENT_MIN_FOLK_VOTES, type AlignmentComparison, type AlignmentSide, type AlignmentVerdict, type FolkVoteCounts, type SakVotering } from './types';
import { pickPrimaryVotering, voteringDecidedCount } from '@/lib/stortinget-voteringer';

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function sideFromCounts(forCount: number, againstCount: number): AlignmentSide {
  if (forCount === againstCount) return 'tie';
  return forCount > againstCount ? 'for' : 'against';
}

function sideLabel(side: AlignmentSide, opts?: { stortinget?: boolean }): string {
  switch (side) {
    case 'for':
      return opts?.stortinget ? 'vedtok' : 'For';
    case 'against':
      return opts?.stortinget ? 'nedstemte' : 'Mot';
    case 'tie':
      return 'uavgjort';
    default: {
      const _exhaustive: never = side;
      return _exhaustive;
    }
  }
}

function verdictFrom(score: number | null, sameSide: boolean): AlignmentVerdict {
  if (score == null) return 'insufficient';
  if (!sameSide) return score >= 40 ? 'partial' : 'divergent';
  if (score >= 70) return 'aligned';
  if (score >= 40) return 'partial';
  return 'divergent';
}

export function alignmentScore(folkForShare: number, stortingetForShare: number, sameSide: boolean): number {
  const gap = Math.abs(folkForShare - stortingetForShare) * 100;
  if (sameSide) return Math.round(Math.max(0, Math.min(100, 100 - gap)));
  return Math.round(Math.max(0, Math.min(100, 45 - gap)));
}

export function buildAlignmentComparison(
  folk: FolkVoteCounts,
  voteringer: SakVotering[],
): AlignmentComparison {
  const votering = pickPrimaryVotering(voteringer);
  const folkTotal = folk.total || folk.for + folk.against + folk.abstain;
  const folkDecided = folk.for + folk.against;
  const folkForPercent = percent(folk.for, folkTotal);
  const folkAgainstPercent = percent(folk.against, folkTotal);
  const folkAbstainPercent = percent(folk.abstain, folkTotal);
  const folkSide = sideFromCounts(folk.for, folk.against);

  if (!votering) {
    return {
      folk,
      folkForPercent,
      folkAgainstPercent,
      folkAbstainPercent,
      folkSide,
      stortinget: null,
      stortingetForPercent: null,
      stortingetAgainstPercent: null,
      stortingetSide: null,
      score: null,
      gapPoints: null,
      verdict: 'pending',
      headline:
        folkTotal > 0
          ? `${folkForPercent} % av brukerne stemte For. Stortinget har ikke votert i saken ennå.`
          : 'Stortinget har ikke votert i saken ennå.',
      summary:
        'Når Stortinget har votert, viser vi avstanden mellom folkets mening i appen og det faktiske vedtaket.',
      votering: null,
      otherVoteringCount: 0,
    };
  }

  const stFor = votering.antall_for ?? 0;
  const stAgainst = votering.antall_mot ?? 0;
  const stAbsent = votering.antall_ikke_tilstede ?? 0;
  const stDecided = voteringDecidedCount(votering);
  const stForPercent = percent(stFor, stDecided);
  const stAgainstPercent = percent(stAgainst, stDecided);
  const stSide: AlignmentSide = votering.vedtatt ? 'for' : sideFromCounts(stFor, stAgainst);
  const otherVoteringCount = Math.max(0, voteringer.length - 1);

  const stortinget = {
    for: stFor,
    against: stAgainst,
    absent: stAbsent,
    decided: stDecided,
    adopted: Boolean(votering.vedtatt),
  };

  if (folkTotal < ALIGNMENT_MIN_FOLK_VOTES) {
    const adoptedLabel = stortinget.adopted ? 'vedtok forslaget' : 'nedstemte forslaget';
    return {
      folk,
      folkForPercent,
      folkAgainstPercent,
      folkAbstainPercent,
      folkSide,
      stortinget,
      stortingetForPercent: stForPercent,
      stortingetAgainstPercent: stAgainstPercent,
      stortingetSide: stSide,
      score: null,
      gapPoints: null,
      verdict: 'insufficient',
      headline: `Stortinget ${adoptedLabel} med ${stForPercent} % For og ${stAgainstPercent} % Mot.`,
      summary: `Folkets mening vises når minst ${ALIGNMENT_MIN_FOLK_VOTES} anonyme stemmer er avgitt i appen.`,
      votering,
      otherVoteringCount,
    };
  }

  const folkShare = folkDecided > 0 ? folk.for / folkDecided : 0;
  const stShare = stDecided > 0 ? stFor / stDecided : 0;
  const sameSide = folkSide !== 'tie' && stSide !== 'tie' && folkSide === stSide;
  const score = alignmentScore(folkShare, stShare, sameSide);
  const gapPoints = Math.round(Math.abs(folkShare - stShare) * 100);
  const verdict = verdictFrom(score, sameSide);

  const folkPhrase = `${folkForPercent} % av brukerne stemte For`;
  const stPhrase = stortinget.adopted
    ? `Stortinget vedtok forslaget med ${stForPercent} % flertall`
    : `Stortinget nedstemte forslaget med ${stAgainstPercent} % Mot`;

  let headline = `${folkPhrase}. ${stPhrase}.`;
  if (!sameSide && folkSide === 'for') {
    headline = `${folkPhrase}, men ${stPhrase}.`;
  } else if (!sameSide && folkSide === 'against') {
    headline = `${folkAgainstPercent} % av brukerne stemte Mot, men ${stPhrase}.`;
  } else if (sameSide) {
    headline = `${folkPhrase}, og ${stPhrase}.`;
  }

  const summary = sameSide
    ? `Flertallet i appen og på Stortinget peker samme vei (${sideLabel(folkSide)}). Avstanden i For-andel er ${gapPoints} prosentpoeng.`
    : `Folket i appen og Stortinget landet på hver sin side. Avstanden i For-andel er ${gapPoints} prosentpoeng.`;

  return {
    folk,
    folkForPercent,
    folkAgainstPercent,
    folkAbstainPercent,
    folkSide,
    stortinget,
    stortingetForPercent: stForPercent,
    stortingetAgainstPercent: stAgainstPercent,
    stortingetSide: stSide,
    score,
    gapPoints,
    verdict,
    headline,
    summary,
    votering,
    otherVoteringCount,
  };
}
