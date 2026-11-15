export type SourceType = 'stortinget' | 'web';

export type NormalizedSourceHit = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedAt?: string;
  sourceType: SourceType;
};

export type PublicSearchScope =
  | { kind: 'topic'; topicId: string }
  | { kind: 'issue'; issueId: string };

export const PUBLIC_SEARCH_SCOPE_KINDS = ['topic', 'issue'] as const;