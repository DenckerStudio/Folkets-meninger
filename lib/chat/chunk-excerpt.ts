/** Per-chunk excerpt cap for chat prompts (~3500-token chunks + margin). */
export const CHAT_EXCERPT_MAX_CHARS = 4800;

/** Total character budget for all chunk excerpts in one sak context. */
export const CHAT_EXCERPT_TOTAL_BUDGET_CHARS = 16_000;

const MIN_EXCERPT_CHARS = 120;

export function normalizeChunkText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

/** UI-only: collapse blank lines so line-clamp cards show more substance. */
export function formatChunkExcerptForDisplay(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^\n+/, '')
    .replace(/\n\s*\n/g, '\n')
    .trimEnd();
}

function queryTerms(query: string): string[] {
  const needle = query.toLowerCase().trim();
  if (!needle) return [];
  const words = needle.split(/\s+/).filter((word) => word.length > 2);
  if (words.length > 0) return [...new Set(words)];
  return needle.length >= 2 ? [needle] : [];
}

/**
 * When text exceeds maxChars, return a window centered on the best-matching query
 * terms instead of always taking the head.
 */
export function excerptChunkForQuery(text: string, query: string, maxChars: number): string {
  const normalized = normalizeChunkText(text);
  if (!normalized || maxChars <= 0) return '';
  if (normalized.length <= maxChars) return normalized;

  const terms = queryTerms(query);
  const lower = normalized.toLowerCase();
  let start = 0;

  if (terms.length > 0) {
    let bestStart = 0;
    let bestScore = -1;
    for (const term of terms) {
      let idx = 0;
      while (idx < lower.length) {
        const found = lower.indexOf(term, idx);
        if (found < 0) break;
        const center = found + Math.floor(term.length / 2);
        const candidateStart = Math.max(
          0,
          Math.min(center - Math.floor(maxChars / 2), normalized.length - maxChars),
        );
        const window = lower.slice(candidateStart, candidateStart + maxChars);
        const score = terms.reduce((sum, t) => sum + (window.includes(t) ? 1 : 0), 0);
        if (score > bestScore) {
          bestScore = score;
          bestStart = candidateStart;
        }
        idx = found + term.length;
      }
    }
    if (bestScore > 0) start = bestStart;
  }

  let end = Math.min(normalized.length, start + maxChars);
  if (end - start < maxChars) {
    start = Math.max(0, end - maxChars);
  }

  let slice = normalized.slice(start, end);
  if (start > 0) {
    const nextSpace = slice.indexOf(' ');
    if (nextSpace > 0 && nextSpace < 48) slice = slice.slice(nextSpace + 1);
    slice = `…${slice}`;
  }
  if (end < normalized.length) {
    const lastSpace = slice.lastIndexOf(' ');
    if (lastSpace > slice.length - 48 && lastSpace > 0) slice = slice.slice(0, lastSpace);
    slice = `${slice}…`;
  }
  const trimmed = slice.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1))}…`;
}

export type RankedChunkExcerpt = {
  content: string;
  rank?: number;
  chunkIndex?: number;
};

export type SakIndexedChunk<T extends RankedChunkExcerpt = RankedChunkExcerpt> = T & {
  sakIndex: number;
};

/**
 * Apply per-excerpt caps and a total budget in **incoming order** (e.g. semantic
 * before hybrid/lexical from `mergeChunks`). Do not re-sort by `rank` — semantic
 * similarity is 0–1 while lexical scores are much larger.
 */
export function applyChunkExcerptsForChat<T extends RankedChunkExcerpt>(
  chunks: readonly T[],
  query: string,
  options: {
    maxPerExcerpt?: number;
    totalBudget?: number;
  } = {},
): T[] {
  const maxPerExcerpt = options.maxPerExcerpt ?? CHAT_EXCERPT_MAX_CHARS;
  const totalBudget = options.totalBudget ?? CHAT_EXCERPT_TOTAL_BUDGET_CHARS;

  const out: T[] = [];
  let budget = totalBudget;

  for (const chunk of chunks) {
    if (budget < MIN_EXCERPT_CHARS) break;
    const maxLen = Math.min(maxPerExcerpt, budget);
    const content = excerptChunkForQuery(chunk.content, query, maxLen);
    if (!content) continue;
    out.push({ ...chunk, content });
    budget -= content.length;
  }

  return out;
}

/**
 * One shared excerpt budget across several saker (topic context). Chunks are
 * budgeted round-robin (chunk 0 from every sak, then chunk 1, …) so one sak
 * cannot consume the entire 16k before others get an excerpt.
 */
export function applyTopicWideChunkExcerpts<T extends RankedChunkExcerpt>(
  sakerChunks: ReadonlyArray<readonly T[]>,
  query: string,
  totalBudget: number = CHAT_EXCERPT_TOTAL_BUDGET_CHARS,
): T[][] {
  const flat: SakIndexedChunk<T>[] = [];
  const maxChunks = Math.max(0, ...sakerChunks.map((chunks) => chunks.length));
  for (let chunkIndex = 0; chunkIndex < maxChunks; chunkIndex += 1) {
    for (let sakIndex = 0; sakIndex < sakerChunks.length; sakIndex += 1) {
      const chunk = sakerChunks[sakIndex]?.[chunkIndex];
      if (chunk) flat.push({ ...chunk, sakIndex });
    }
  }

  const excerpted = applyChunkExcerptsForChat(flat, query, { totalBudget });
  const grouped = sakerChunks.map(() => [] as T[]);
  for (const row of excerpted) {
    const { sakIndex, ...chunk } = row as SakIndexedChunk<T>;
    grouped[sakIndex]?.push(chunk as unknown as T);
  }
  return grouped;
}
