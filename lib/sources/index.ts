export type { NormalizedSourceHit, PublicSearchScope, SourceType } from '@/lib/sources/types';
export { findMoreSources, type FindMoreSourcesResult } from '@/lib/sources/find-more-sources';
export {
  buildPublicSearchQuery,
  composePublicSearchQuery,
  type BuildPublicSearchQueryResult,
} from '@/lib/sources/build-public-search-query';
export {
  parsePublicSearchRequestBody,
  FORBIDDEN_PUBLIC_SEARCH_BODY_KEYS,
} from '@/lib/sources/parse-public-search-request';
export { isWebSearchEnabled, getWebSearchBaseUrl } from '@/lib/sources/web-search';
export { appendSourcesToResearchTopic } from '@/lib/sources/save-topic-sources';