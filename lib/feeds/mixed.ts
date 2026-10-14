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

/**
 * Spread inserts evenly through `items` instead of only at fixed multiples.
 *
 * `interleaveEvery` puts a promo after every Nth opinion, so a short (or
 * filtered) list of fewer than N opinions would never show one. This places
 * each insert at a fraction of the list — `floor((i + 1) * n / (m + 1)) - 1` —
 * so promos always appear, spaced as evenly as the item count allows. Inserts
 * never land before the first item.
 */
export function interleaveEvenly<T, I>(
  items: readonly T[],
  inserts: readonly I[],
): (T | I)[] {
  const n = items.length;
  const m = inserts.length;
  if (m === 0) return [...items];
  if (n === 0) return [...inserts];

  const perItem: I[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < m; i += 1) {
    const raw = Math.floor(((i + 1) * n) / (m + 1)) - 1;
    const position = Math.min(n - 1, Math.max(0, raw));
    perItem[position].push(inserts[i]);
  }

  const out: (T | I)[] = [];
  for (let index = 0; index < n; index += 1) {
    out.push(items[index]);
    for (const insert of perItem[index]) out.push(insert);
  }
  return out;
}
