import { rankSakOptions, tokenizeOpinionQuery } from '@/lib/opinions/sak-relevance';
import type { SakPickerOption } from '@/lib/opinions/types';

export type StortingetIssueSearchRow = {
  id: string;
  title: string;
  summary?: string | null;
  category?: string | null;
  henvisning?: string | null;
  status?: SakPickerOption['status'];
};

/** Fold æøå for tolerant matching (e.g. «arsrapport» vs «årsrapportar»). */
export function foldNorwegianForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a');
}

function toPickerOption(row: StortingetIssueSearchRow): SakPickerOption {
  return {
    id: row.id,
    title: row.title,
    category: row.category ?? null,
    henvisning: row.henvisning ?? null,
    status: row.status ?? 'pending',
  };
}

/**
 * Shared sak search for Utforsk and Folkets meninger sak-picker (token + title/category/henvisning/summary).
 */
export function issueMatchesStortingetSearch(
  row: StortingetIssueSearchRow,
  rawQuery: string,
): boolean {
  const query = rawQuery.trim();
  if (!query) return true;

  const foldedQuery = foldNorwegianForSearch(query);
  const haystack = foldNorwegianForSearch(
    [row.title, row.summary ?? '', row.category ?? '', row.henvisning ?? '', row.id].join(' '),
  );
  if (foldedQuery.length >= 2 && haystack.includes(foldedQuery)) {
    return true;
  }

  const ranked = rankSakOptions([toPickerOption(row)], query, 1);
  if (ranked.length > 0) return true;

  const tokens = tokenizeOpinionQuery(query);
  const summaryFolded = foldNorwegianForSearch(row.summary ?? '');
  return tokens.some((token) => {
    const foldedToken = foldNorwegianForSearch(token);
    return foldedToken.length >= 2 && summaryFolded.includes(foldedToken);
  });
}
