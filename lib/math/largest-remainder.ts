/**
 * Integer percents that sum to 100 (largest-remainder method).
 */
export function largestRemainderPercents(weights: readonly number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    return weights.map(() => 0);
  }

  const raw = weights.map((w) => (w / total) * 100);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = 100 - floors.reduce((sum, f) => sum + f, 0);

  const byRemainder = raw
    .map((r, index) => ({ index, remainder: r - Math.floor(r) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  const result = [...floors];
  for (let i = 0; i < remainder; i++) {
    result[byRemainder[i]!.index] += 1;
  }
  return result;
}