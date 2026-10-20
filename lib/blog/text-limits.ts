const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('nb', { granularity: 'grapheme' })
    : null;

export const BLOG_TITLE_MAX = 110;
export const BLOG_EXCERPT_MAX = 300;
export const BLOG_BLUESKY_MAX = 300;

export function normalizeBlogTitle(raw: string): string {
  return raw.trim().slice(0, BLOG_TITLE_MAX);
}

export function graphemeCount(value: string): number {
  if (!value) return 0;
  if (segmenter) {
    return [...segmenter.segment(value)].length;
  }
  return value.length;
}

export function truncateToGraphemes(value: string, max: number): string {
  if (!value || max <= 0) return '';
  if (!segmenter) return value.slice(0, max);
  let count = 0;
  let result = '';
  for (const part of segmenter.segment(value)) {
    if (count >= max) break;
    result += part.segment;
    count += 1;
  }
  return result;
}

export function normalizeBlogExcerpt(raw: string): string {
  return raw.trim().slice(0, BLOG_EXCERPT_MAX);
}

export function normalizeBlueskyText(excerpt: string, blueskyRaw?: string | null): string {
  const fallback = normalizeBlogExcerpt(excerpt);
  const source = (blueskyRaw?.trim() || fallback).trim();
  const clipped = truncateToGraphemes(source, BLOG_BLUESKY_MAX);
  if (graphemeCount(clipped) > BLOG_BLUESKY_MAX) {
    throw new Error(`bluesky_text kan være maks ${BLOG_BLUESKY_MAX} grafemer`);
  }
  return clipped;
}

export function validateBlueskyGraphemes(value: string): string | null {
  if (graphemeCount(value) > BLOG_BLUESKY_MAX) {
    return `bluesky_text kan være maks ${BLOG_BLUESKY_MAX} grafemer`;
  }
  return null;
}
