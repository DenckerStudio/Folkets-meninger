const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('nb', { granularity: 'grapheme' })
    : null;

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
