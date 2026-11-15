import type { SakListItem } from '@/lib/stortinget';
import { issueMatchesStortingetSearch } from '@/lib/stortinget-issue-search';
import { shouldFallbackUtforskToLexicalSearch } from '@/lib/search/utforsk-search-fallback';
import { UTFORSK_ISSUE_SEARCH_MIN_QUERY_CHARS } from '@/lib/search/utforsk-issue-search-api';

export const UTFORSK_SORT_OPTIONS = [
  'Mest relevant',
  'Nyeste først',
  'Mest engasjement',
  'Snart votering',
] as const;

export type UtforskSortOption = (typeof UTFORSK_SORT_OPTIONS)[number];

export const UTFORSK_DEFAULT_SORT: UtforskSortOption = 'Nyeste først';

export function isUtforskSortOption(value: unknown): value is UtforskSortOption {
  return typeof value === 'string' && (UTFORSK_SORT_OPTIONS as readonly string[]).includes(value);
}

export function isUtforskSearchQueryActive(trimmedQuery: string): boolean {
  return trimmedQuery.length >= UTFORSK_ISSUE_SEARCH_MIN_QUERY_CHARS;
}

/** Sort while the user is not in an active search session (persisted preference). */
export function utforskSortWithoutSearchSession(persistedSort: UtforskSortOption): UtforskSortOption {
  return persistedSort === 'Mest relevant' ? UTFORSK_DEFAULT_SORT : persistedSort;
}

/** Sort during an active search; `sessionSort` is set once to «Mest relevant» then follows explicit user picks. */
export function utforskSortDuringSearchSession(sessionSort: UtforskSortOption): UtforskSortOption {
  return sessionSort;
}

export function resolveUtforskEffectiveSort(
  searchActive: boolean,
  sessionSort: UtforskSortOption | null,
  persistedSort: UtforskSortOption,
): UtforskSortOption {
  if (!searchActive) {
    return utforskSortWithoutSearchSession(persistedSort);
  }
  return sessionSort ?? 'Mest relevant';
}

/** Sort applied when a new search session starts (query reached min length). */
export const UTFORSK_DEFAULT_SEARCH_SESSION_SORT: UtforskSortOption = 'Mest relevant';

export function utforskSortOptionsForQuery(searchActive: boolean): readonly UtforskSortOption[] {
  if (!searchActive) {
    return UTFORSK_SORT_OPTIONS.filter((option) => option !== 'Mest relevant');
  }
  return UTFORSK_SORT_OPTIONS;
}

export function votingUrgencyForSort(issue: SakListItem): number {
  if (issue.votingOpen && issue.votingDaysLeft != null && issue.votingDaysLeft > 0) {
    return issue.votingDaysLeft;
  }
  return Number.POSITIVE_INFINITY;
}

export function issueEngagementTotalForSort(issue: SakListItem): number {
  return issue.votes?.total ?? 0;
}

export type UtforskSearchFilterInput = {
  trimmedQuery: string;
  hybridIssueIds: string[] | null;
  hybridCommittedQuery: string | null;
};

/** Filter issues by search; hybrid ids only apply when committed for the current query. */
export function filterUtforskIssuesBySearch(
  issues: readonly SakListItem[],
  input: UtforskSearchFilterInput,
): SakListItem[] {
  const { trimmedQuery, hybridIssueIds, hybridCommittedQuery } = input;
  if (!isUtforskSearchQueryActive(trimmedQuery)) return [...issues];

  const hybridReady =
    hybridCommittedQuery === trimmedQuery &&
    !shouldFallbackUtforskToLexicalSearch(hybridIssueIds);

  if (!hybridReady) {
    return issues.filter((issue) => issueMatchesStortingetSearch(issue, trimmedQuery));
  }

  if (!hybridIssueIds || hybridIssueIds.length === 0) {
    return [];
  }

  const allowed = new Set(hybridIssueIds.map(String));
  return issues.filter((issue) => allowed.has(String(issue.id)));
}

export function sortUtforskIssues(
  issues: SakListItem[],
  sort: UtforskSortOption,
  hybridRankById: Map<string, number> | null,
): SakListItem[] {
  if (sort === 'Snart votering') {
    return [...issues].filter((issue) => votingUrgencyForSort(issue) !== Number.POSITIVE_INFINITY);
  }

  return [...issues].sort((a, b) => {
    if (sort === 'Mest relevant' && hybridRankById) {
      const rankA = hybridRankById.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER;
      const rankB = hybridRankById.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
    }
    if (sort === 'Nyeste først' || sort === 'Mest relevant') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (sort === 'Mest engasjement') {
      const voteDiff = issueEngagementTotalForSort(b) - issueEngagementTotalForSort(a);
      if (voteDiff !== 0) return voteDiff;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (sort === 'Snart votering') {
      return votingUrgencyForSort(a) - votingUrgencyForSort(b);
    }
    return 0;
  });
}

export function buildHybridRankMap(issueIds: string[] | null): Map<string, number> | null {
  if (!issueIds || issueIds.length === 0) return null;
  return new Map(issueIds.map((id, index) => [String(id), index]));
}