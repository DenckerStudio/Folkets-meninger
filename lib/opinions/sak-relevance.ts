import type { SakTreatmentStatus } from '@/lib/sak-status';
import type { SakPickerOption } from './types';

export const SAK_PICKER_BROWSE_PAGE_SIZE = 25;
export const SAK_PICKER_SEARCH_LIMIT = 50;

export type SakPickerStatusFilter = 'all' | SakTreatmentStatus;

const STOPWORDS = new Set([
  'alle',
  'andre',
  'at',
  'av',
  'bare',
  'bli',
  'blir',
  'da',
  'de',
  'deg',
  'den',
  'denne',
  'det',
  'dette',
  'disse',
  'du',
  'eller',
  'en',
  'enn',
  'er',
  'et',
  'etter',
  'for',
  'fra',
  'før',
  'ha',
  'hadde',
  'har',
  'hun',
  'hva',
  'hvor',
  'hvordan',
  'hvorfor',
  'i',
  'ikke',
  'inn',
  'jeg',
  'kan',
  'man',
  'med',
  'meg',
  'men',
  'min',
  'mot',
  'når',
  'og',
  'også',
  'om',
  'oss',
  'over',
  'på',
  'sak',
  'saken',
  'skal',
  'som',
  'stortinget',
  'til',
  'under',
  'ut',
  'ved',
  'vi',
  'vil',
  'være',
  'vært',
  'å',
]);

export function tokenizeOpinionQuery(text: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  const parts = text
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u);

  for (const part of parts) {
    if (part.length < 3 || STOPWORDS.has(part) || seen.has(part)) continue;
    seen.add(part);
    tokens.push(part);
  }

  return tokens;
}

function scoreSakOption(option: SakPickerOption, query: string, tokens: string[]): number {
  const title = option.title.toLowerCase();
  const category = (option.category ?? '').toLowerCase();
  const henvisning = (option.henvisning ?? '').toLowerCase();
  const haystack = `${title} ${category} ${henvisning}`;
  let score = 0;

  if (query) {
    if (option.id === query || option.id.endsWith(query)) score += 80;
    else if (option.id.includes(query)) score += 40;
    if (title.includes(query)) score += 28;
  }

  for (const token of tokens) {
    if (title.includes(token)) score += 10;
    if (category.includes(token)) score += 5;
    if (henvisning.includes(token)) score += 3;
    const word = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(token)}(?:$|[^\\p{L}\\p{N}])`, 'u');
    if (word.test(haystack)) score += 6;
  }

  return score;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rankSakOptions(
  options: SakPickerOption[],
  context: string,
  limit = 8,
): SakPickerOption[] {
  const query = context.trim().toLowerCase();
  const tokens = tokenizeOpinionQuery(context);
  if (!query) return [];

  const ranked = options
    .map((option) => ({ option, score: scoreSakOption(option, query, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.option.title.localeCompare(b.option.title, 'nb'));

  return ranked.slice(0, limit).map((entry) => entry.option);
}

function compareBrowseOrder(a: SakPickerOption, b: SakPickerOption): number {
  const aPending = a.status === 'pending' ? 1 : 0;
  const bPending = b.status === 'pending' ? 1 : 0;
  if (aPending !== bPending) return bPending - aPending;
  return a.title.localeCompare(b.title, 'nb');
}

export function filterSakPickerOptions(
  options: SakPickerOption[],
  filters: { status?: SakPickerStatusFilter; category?: string | null },
): SakPickerOption[] {
  let next = options;
  const status = filters.status ?? 'all';
  if (status !== 'all') {
    next = next.filter((option) => option.status === status);
  }
  const category = filters.category?.trim();
  if (category) {
    next = next.filter((option) => (option.category ?? '').toLowerCase() === category.toLowerCase());
  }
  return next;
}

export function topSakPickerCategories(options: SakPickerOption[], max = 10): string[] {
  const counts = new Map<string, number>();
  for (const option of options) {
    const name = option.category?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nb'))
    .slice(0, max)
    .map(([name]) => name);
}

export function sortSakOptionsForBrowse(options: SakPickerOption[]): SakPickerOption[] {
  return [...options].sort(compareBrowseOrder);
}

export function buildSakPickerResultList(input: {
  options: SakPickerOption[];
  searchQuery: string;
  titleContext: string;
  statusFilter: SakPickerStatusFilter;
  categoryFilter: string | null;
  visibleCount: number;
}): {
  rows: SakPickerOption[];
  listLabel: string;
  totalMatching: number;
  hasMore: boolean;
  suggestionIds: Set<string>;
} {
  const filtered = filterSakPickerOptions(input.options, {
    status: input.statusFilter,
    category: input.categoryFilter,
  });

  const trimmedSearch = input.searchQuery.trim();
  const hasSearch = trimmedSearch.length > 0;
  const titleContext = input.titleContext.trim();
  const hasTitleContext = tokenizeOpinionQuery(titleContext).length > 0 || titleContext.length >= 5;

  let base: SakPickerOption[];
  let listLabel: string;
  const suggestionIds = new Set<string>();

  if (hasSearch) {
    const combined = [trimmedSearch, titleContext].filter(Boolean).join(' ');
    base = rankSakOptions(filtered, combined, SAK_PICKER_SEARCH_LIMIT);
    listLabel = 'Søketreff';
  } else if (hasTitleContext) {
    const suggestions = rankSakOptions(filtered, titleContext, 12);
    for (const option of suggestions) suggestionIds.add(option.id);
    const browse = sortSakOptionsForBrowse(
      filtered.filter((option) => !suggestionIds.has(option.id)),
    );
    base = [...suggestions, ...browse];
    listLabel = suggestions.length > 0 ? 'Forslag ut fra tittelen' : 'Saker du kan knytte til';
  } else {
    base = sortSakOptionsForBrowse(filtered);
    listLabel =
      input.statusFilter === 'pending'
        ? 'Saker under behandling'
        : input.statusFilter === 'closed'
          ? 'Ferdigbehandlede saker'
          : 'Alle saker';
  }

  const totalMatching = base.length;
  const rows = base.slice(0, input.visibleCount);
  const hasMore = totalMatching > input.visibleCount;

  return { rows, listLabel, totalMatching, hasMore, suggestionIds };
}
