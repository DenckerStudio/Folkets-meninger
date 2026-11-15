import { UTFORSK_ISSUE_SEARCH_MAX_QUERY_CHARS } from '@/lib/search/utforsk-issue-search-api';

export function buildTopicAroundSearchQuery(input: {
  title: string;
  summary?: string | null;
}): string {
  const title = input.title.replace(/\s+/g, ' ').trim();
  if (!title) return '';

  const summary = (input.summary ?? '').replace(/\s+/g, ' ').trim();
  if (!summary || summary.length < 12) {
    return title.slice(0, UTFORSK_ISSUE_SEARCH_MAX_QUERY_CHARS);
  }

  const combined = `${title}. ${summary}`;
  return combined.slice(0, UTFORSK_ISSUE_SEARCH_MAX_QUERY_CHARS);
}

export function buildTopicAroundRelatedReason(themeLabel: string): string {
  const trimmed = themeLabel.replace(/\s+/g, ' ').trim();
  if (!trimmed) return 'Felles tema i Stortinget-dokumenter';
  const short =
    trimmed.length > 72 ? `${trimmed.slice(0, 69).trimEnd()}…` : trimmed;
  return `Felles tema: ${short}`;
}