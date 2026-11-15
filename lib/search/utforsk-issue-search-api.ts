export const UTFORSK_ISSUE_SEARCH_MAX_QUERY_CHARS = 120;
export const UTFORSK_ISSUE_SEARCH_MIN_QUERY_CHARS = 2;
export const UTFORSK_ISSUE_SEARCH_IP_LIMIT = 30;
export const UTFORSK_ISSUE_SEARCH_IP_WINDOW_MS = 60_000;

export function utforskIssueSearchRateLimitKey(ip: string): string {
  const normalized = ip.trim() || 'unknown';
  return `utforsk-issue-search:ip:${normalized}`;
}

export function normalizeUtforskIssueSearchQuery(raw: string | null | undefined): {
  query: string;
  shouldSearch: boolean;
} {
  const query = (raw ?? '').trim().slice(0, UTFORSK_ISSUE_SEARCH_MAX_QUERY_CHARS);
  return {
    query,
    shouldSearch: query.length >= UTFORSK_ISSUE_SEARCH_MIN_QUERY_CHARS,
  };
}