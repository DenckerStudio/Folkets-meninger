/**
 * Pure helpers for finding saker from a free-text question.
 *
 * The old search ran `title ilike '%<whole question>%'`, which only matched when a
 * user's entire sentence appeared verbatim inside a title — almost never. These
 * helpers split the question into significant terms, OR them across the searchable
 * columns, and rank the candidates by where and how well they matched.
 */

/** Norwegian + parliamentary boilerplate. Keeps real topic words searchable. */
export const SAK_STOPWORDS = new Set([
  'om',
  'for',
  'og',
  'i',
  'av',
  'til',
  'en',
  'et',
  'den',
  'det',
  'de',
  'som',
  'er',
  'på',
  'med',
  'fra',
  'ved',
  'eller',
  'men',
  'ikke',
  'skal',
  'kan',
  'vil',
  'har',
  'var',
  'lov',
  'loven',
  'lover',
  'lovendr',
  'lovforslag',
  'endringer',
  'forslag',
  'representantforslag',
  'stortinget',
  'innstilling',
  'proposisjon',
  'dokument',
  'hva',
  'hvem',
  'hvor',
  'når',
  'hvorfor',
  'hvordan',
  'hvilke',
  'hvilken',
  'hvilket',
  'vises',
  'vite',
  'finne',
  'søke',
  'saker',
  'sak',
  'noe',
  'noen',
  'meg',
  'deg',
  'dere',
  'være',
  'blir',
  'ble',
  'blitt',
  'også',
  'bare',
  'meget',
  'litt',
  'mye',
  'noe',
  'denne',
  'dette',
  'disse',
  'sine',
  'deres',
  'vår',
  'hva',
]);

/** Shortest term worth searching for. Below this, matches are mostly noise. */
const MIN_TERM_LENGTH = 3;

/** Cap the OR-expansion so a long question cannot fan out into many DB round trips. */
export const MAX_SEARCH_TERMS = 3;

const MAX_QUERY_LENGTH = 120;

export function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Contentful tokens from free text — skips boilerplate and filler words. */
export function significantTokens(
  ...parts: Array<string | null | undefined>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const raw of part.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      const word = raw.trim();
      if (word.length < MIN_TERM_LENGTH || SAK_STOPWORDS.has(word) || seen.has(word)) continue;
      seen.add(word);
      out.push(word);
    }
  }
  return out;
}

/**
 * Build the terms to search for. Falls back to the whole trimmed query when every
 * token was filtered out (e.g. "Hva er loven?"), so a short question still tries
 * something instead of silently returning nothing.
 */
/**
 * Normalized lexemes for prefix FTS (`term:* | …`). Splits on non-alphanumeric
 * runs (e.g. `2024/25` → `2024`, `25`) and drops pieces shorter than MIN_TERM_LENGTH.
 */
export function buildIssuePrefixTsqueryOperands(terms: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const pieces = term.trim().toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    for (const lexeme of pieces) {
      if (lexeme.length < MIN_TERM_LENGTH || seen.has(lexeme)) continue;
      seen.add(lexeme);
      out.push(lexeme);
    }
  }
  return out;
}

/** OR-joined prefix operands for `to_tsquery('norwegian', …)` in search_issues_fts. */
export function formatIssuePrefixTsquery(terms: readonly string[]): string | null {
  const operands = buildIssuePrefixTsqueryOperands(terms);
  if (operands.length === 0) return null;
  return operands.map((term) => `${term}:*`).join(' | ');
}

export function buildSearchTerms(
  query: string,
  maxTerms: number = MAX_SEARCH_TERMS,
): string[] {
  const trimmed = (query ?? '').trim().slice(0, MAX_QUERY_LENGTH);
  if (!trimmed) return [];
  const terms = significantTokens(trimmed);
  if (terms.length > 0) return terms.slice(0, Math.max(1, maxTerms));
  const fallback = trimmed.replace(/\s+/g, ' ');
  return fallback.length >= 2 ? [fallback.slice(0, 40)] : [];
}

/** Stortinget ids are numeric; allow an exact-id lookup for them. */
export function looksLikeIssueId(query: string): boolean {
  const trimmed = (query ?? '').trim();
  return /^\d{4,10}$/.test(trimmed);
}

export type SakSearchRow = {
  id: string;
  title: string | null;
  summary: string | null;
  henvisning: string | null;
  ferdigbehandlet: boolean | null;
};

/**
 * Score a candidate against the searched terms. Title matches count for most (a
 * title is curated), henvisning next, summary least. Matching *every* term is worth
 * a large bonus so "hva koster innvandringsloven" ranks a sak titled
 * "Innvandringsloven" above one that merely mentions "loven" in passing.
 */
export function scoreSakRow(
  row: SakSearchRow,
  terms: readonly string[],
  phrase: string,
): number {
  if (terms.length === 0) return 0;
  const title = (row.title ?? '').toLowerCase();
  const henvisning = (row.henvisning ?? '').toLowerCase();
  const summary = (row.summary ?? '').toLowerCase();

  let score = 0;
  let matched = 0;
  for (const term of terms) {
    const needle = term.toLowerCase();
    let hit = 0;
    if (title.includes(needle)) hit = 12;
    else if (henvisning.includes(needle)) hit = 9;
    else if (summary.includes(needle)) hit = 4;
    if (hit > 0) {
      matched += 1;
      score += hit;
    }
  }

  if (matched === 0) return 0;
  // Coverage beats raw hit count: matching all terms is a much better answer.
  score += matched === terms.length ? 30 : 0;
  // The original phrase appearing intact is the strongest single signal.
  const normalizedPhrase = phrase.trim().toLowerCase();
  if (normalizedPhrase.length >= 4) {
    if (title.includes(normalizedPhrase)) score += 20;
    else if (henvisning.includes(normalizedPhrase)) score += 15;
  }

  return score;
}

/**
 * Rank already-fetched candidate rows by relevance. Pure, so it is unit tested
 * without a database. Returns at most `limit` rows, best first.
 */
export function rankSakRows(
  rows: readonly SakSearchRow[],
  terms: readonly string[],
  phrase: string,
  limit = 6,
): SakSearchRow[] {
  const scored: Array<{ row: SakSearchRow; score: number; index: number }> = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    if (!row || typeof row.id !== 'string' || !row.id) return;
    if (seen.has(row.id)) return;
    seen.add(row.id);
    const score = scoreSakRow(row, terms, phrase);
    if (score <= 0) return;
    scored.push({ row, score, index });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.row);
}