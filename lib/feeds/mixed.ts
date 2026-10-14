/**
 * Pure helpers for weaving two content types into one feed.
 *
 * Used to mix citizen opinions into the Reels carousel (B7) and reel
 * prompts into the Folkets meninger list, without changing either
 * source's own ordering guarantees.
 */
export function interleaveEvery<T, I>(
  items: readonly T[],
  inserts: readonly I[],
  every: number,
): (T | I)[] {
  if (every <= 0 || inserts.length === 0) return [...items];

  const out: (T | I)[] = [];
  let nextInsert = 0;
  items.forEach((item, index) => {
    out.push(item);
    if ((index + 1) % every === 0 && nextInsert < inserts.length) {
      out.push(inserts[nextInsert]);
      nextInsert += 1;
    }
  });
  return out;
}

/** Rotate an array so the first matching item leads, keeping the rest in order. */
export function rotateToMatch<T>(items: readonly T[], match: (item: T) => boolean): T[] {
  const index = items.findIndex(match);
  if (index <= 0) return [...items];
  return [...items.slice(index), ...items.slice(0, index)];
}
