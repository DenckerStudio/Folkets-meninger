import type { OpinionListItem } from '@/lib/opinions/types';

/** Minimum endorsements before an opinion is a candidate for a Reel draft. */
export const OPINION_REEL_MIN_ENGAGEMENT = 5;

/** Builds the ja/nei/blank question shown for an opinion-derived Reel (B6). */
export function buildOpinionReelQuestion(
  opinion: Pick<OpinionListItem, 'title' | 'points'>,
): string {
  const point =
    opinion.points.find((entry) => entry.stance === 'for')?.text?.trim() || opinion.title.trim();
  const trimmed = point.length > 120 ? `${point.slice(0, 117).trimEnd()}…` : point;
  return `Er du enig: «${trimmed}»?`;
}
