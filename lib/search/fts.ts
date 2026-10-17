/**
 * Postgres full-text search settings shared by the app (plan P4).
 *
 * The generated `fts` columns on `stortinget_issues` and `document_chunks`
 * are built with the `norwegian` config (migration
 * 20261018000000_fts_norwegian.sql), so every query against them must use
 * the same config or stemming will not line up.
 */
export const FTS_CONFIG = 'norwegian' as const;

/** Generated tsvector column name on stortinget_issues and document_chunks. */
export const FTS_COLUMN = 'fts' as const;

/**
 * OR query for `to_tsquery(FTS_CONFIG, …)` from free-text search terms.
 * Only letters and digits survive, so user input can never inject tsquery
 * operators. Returns null when nothing searchable is left.
 */
export function buildOrTsQuery(terms: readonly string[]): string | null {
  const lexemes = [
    ...new Set(
      terms
        .flatMap((term) => term.toLowerCase().split(/[^\p{L}\p{N}]+/u))
        .filter((token) => token.length >= 2),
    ),
  ].slice(0, 12);
  return lexemes.length > 0 ? lexemes.join(' | ') : null;
}
