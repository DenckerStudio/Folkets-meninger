/** Norwegian count + «stemme» / «stemmer» for poll vote totals. */
export function formatStemmerCount(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  return `${n} ${n === 1 ? 'stemme' : 'stemmer'}`;
}
