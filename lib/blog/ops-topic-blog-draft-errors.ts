export type OpsTopicBlogDraftErrorCode =
  | 'topic_not_found'
  | 'insufficient_sources'
  | 'invalid_input'
  | 'draft_exists'
  | 'llm_timeout'
  | 'llm_error'
  | 'search_error'
  | 'db_error';

const RETRYABLE: ReadonlySet<OpsTopicBlogDraftErrorCode> = new Set([
  'llm_timeout',
  'llm_error',
  'search_error',
  'db_error',
]);

export function isOpsTopicBlogDraftErrorRetryable(code: OpsTopicBlogDraftErrorCode): boolean {
  return RETRYABLE.has(code);
}

export function httpStatusForOpsTopicBlogDraftError(code: OpsTopicBlogDraftErrorCode): number {
  switch (code) {
    case 'topic_not_found':
      return 404;
    case 'insufficient_sources':
      return 422;
    case 'invalid_input':
      return 400;
    case 'draft_exists':
      return 409;
    case 'llm_timeout':
      return 504;
    case 'llm_error':
      return 502;
    case 'search_error':
      return 502;
    case 'db_error':
      return 500;
    default: {
      const _exhaustive: never = code;
      return 500;
    }
  }
}

export const OPS_TOPIC_BLOG_DRAFT_ERROR_MESSAGE: Record<OpsTopicBlogDraftErrorCode, string> = {
  topic_not_found: 'Fant ikke research-tema.',
  insufficient_sources: 'Temaet er ikke klart for bloggutkast eller har for få kilder.',
  invalid_input: 'Ugyldig forespørsel.',
  draft_exists: 'Det finnes allerede et åpent bloggutkast for dette temaet.',
  llm_timeout: 'Tekstgenerering tok for lang tid. Prøv igjen senere.',
  llm_error: 'Tekstgenerering feilet. Prøv igjen senere.',
  search_error: 'Kildesøk feilet. Prøv igjen senere.',
  db_error: 'Databasefeil. Prøv igjen senere.',
};