import assert from 'node:assert/strict';
import {
  httpStatusForOpsTopicBlogDraftError,
  isOpsTopicBlogDraftErrorRetryable,
  type OpsTopicBlogDraftErrorCode,
} from '@/lib/blog/ops-topic-blog-draft-errors';

const CONTENT: OpsTopicBlogDraftErrorCode[] = [
  'topic_not_found',
  'insufficient_sources',
  'invalid_input',
  'draft_exists',
];

for (const code of CONTENT) {
  assert.equal(isOpsTopicBlogDraftErrorRetryable(code), false);
}

const INFRA: OpsTopicBlogDraftErrorCode[] = [
  'llm_timeout',
  'llm_error',
  'search_error',
  'db_error',
];

for (const code of INFRA) {
  assert.equal(isOpsTopicBlogDraftErrorRetryable(code), true);
}

assert.equal(httpStatusForOpsTopicBlogDraftError('topic_not_found'), 404);
assert.equal(httpStatusForOpsTopicBlogDraftError('insufficient_sources'), 422);
assert.equal(httpStatusForOpsTopicBlogDraftError('invalid_input'), 400);
assert.equal(httpStatusForOpsTopicBlogDraftError('draft_exists'), 409);
assert.equal(httpStatusForOpsTopicBlogDraftError('llm_timeout'), 504);
assert.equal(httpStatusForOpsTopicBlogDraftError('llm_error'), 502);
assert.equal(httpStatusForOpsTopicBlogDraftError('search_error'), 502);
assert.equal(httpStatusForOpsTopicBlogDraftError('db_error'), 500);

console.log('lib/blog/ops-topic-blog-draft-errors.test.ts ok');