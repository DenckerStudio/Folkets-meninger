import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  filterOpenResearchTopicBlogDrafts,
  opsTopicBlogDraftFailure,
  opsTopicBlogDraftJsonBody,
  opsTopicBlogDraftResponseStatus,
  parseOpsTopicBlogDraftBody,
} from '@/lib/blog/ops-topic-blog-draft';

const TOPIC_ID = '11111111-1111-4111-8111-111111111111';

assert.equal(parseOpsTopicBlogDraftBody({ topic_id: TOPIC_ID }).ok, true);
assert.equal(parseOpsTopicBlogDraftBody({ topic_id: '  ' }).ok, false);
assert.equal(parseOpsTopicBlogDraftBody({ topic_id: 'not-a-uuid' }).ok, false);
assert.equal(parseOpsTopicBlogDraftBody(null).ok, false);

const open = filterOpenResearchTopicBlogDrafts([
  {
    id: 'a',
    slug: 's',
    adminUrl: 'u',
    cmsStatus: 'draft',
    sourceEvent: null,
    updatedAt: null,
  },
  {
    id: 'b',
    slug: 's2',
    adminUrl: 'u',
    cmsStatus: 'published',
    sourceEvent: null,
    updatedAt: null,
  },
]);
assert.deepEqual(open.map((row) => row.id), ['a']);

const draftExists = opsTopicBlogDraftFailure('draft_exists', 'post-99');
assert.equal(draftExists.ok, false);
assert.equal(draftExists.error_code, 'draft_exists');
assert.equal(draftExists.retryable, false);
assert.equal(draftExists.draft_id, 'post-99');

const infra = opsTopicBlogDraftFailure('search_error');
assert.equal(infra.retryable, true);

const successJson = opsTopicBlogDraftJsonBody({
  ok: true,
  draft_id: 'd1',
  source_count: 4,
  created: true,
});
assert.deepEqual(successJson, { ok: true, draft_id: 'd1', source_count: 4 });

const errJson = opsTopicBlogDraftJsonBody(draftExists);
assert.equal(errJson.ok, false);
assert.equal(errJson.error_code, 'draft_exists');
assert.equal(errJson.draft_id, 'post-99');
assert.equal(typeof errJson.message, 'string');
assert.equal((errJson.message as string).includes('research'), false);

assert.equal(
  opsTopicBlogDraftResponseStatus({ ok: true, draft_id: 'x', source_count: 1, created: true }),
  200,
);
assert.equal(opsTopicBlogDraftResponseStatus(draftExists), 409);

const routeSrc = readFileSync(
  join(process.cwd(), 'app/api/ops/blog/drafts/from-topic/route.ts'),
  'utf-8',
);
assert.match(routeSrc, /verifyOpsSecret\(request\)/);
assert.match(routeSrc, /createOpsBlogDraftFromTopic/);
assert.match(routeSrc, /maxDuration = 120/);
assert.match(routeSrc, /error_code/);
assert.match(routeSrc, /retryable/);

const libSrc = readFileSync(join(process.cwd(), 'lib/blog/ops-topic-blog-draft.ts'), 'utf-8');
assert.match(libSrc, /finalizeBlogDraftBodyWithSources/);
assert.match(libSrc, /failOnSearchError: true/);
assert.doesNotMatch(libSrc, /topic\.title/);

console.log('lib/blog/ops-topic-blog-draft.test.ts ok');