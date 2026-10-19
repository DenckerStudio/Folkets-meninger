import assert from 'node:assert/strict';
import type { PayloadRequest } from 'payload';
import {
  applyPublishedAtOnPublish,
  isAutosaveRequest,
  isDraftContentSave,
  resolvePublishedAtForPublishedPost,
  setPublishedAtOnPublish,
} from './setPublishedAtOnPublish';

function req(query: Record<string, unknown> = {}): PayloadRequest {
  return { query } as unknown as PayloadRequest;
}

assert.equal(isAutosaveRequest(req({ autosave: 'true' })), true);
assert.equal(isDraftContentSave({ _status: 'draft' }, req()), true);

const createdAt = '2026-03-01T10:00:00.000Z';
const beforeFirstPublish = Date.now();
const firstPublish = applyPublishedAtOnPublish(
  { _status: 'published' },
  { _status: 'draft', createdAt },
);
assert.equal(firstPublish._status, 'published');
assert.ok(typeof firstPublish.publishedAt === 'string' && firstPublish.publishedAt.length > 0);
assert.notEqual(firstPublish.publishedAt, createdAt);
const firstPublishMs = Date.parse(firstPublish.publishedAt!);
assert.ok(firstPublishMs >= beforeFirstPublish - 1000);
assert.ok(firstPublishMs <= Date.now() + 1000);

assert.equal(
  resolvePublishedAtForPublishedPost(
    { _status: 'published', publishedAt: '2026-02-01T00:00:00.000Z' },
    { _status: 'draft', createdAt },
  ),
  '2026-02-01T00:00:00.000Z',
);

const legacyRepublish = applyPublishedAtOnPublish(
  { _status: 'published', publishedAt: '' },
  {
    _status: 'published',
    publishedAt: null,
    createdAt: '2026-02-10T08:30:00.000Z',
  },
);
assert.equal(legacyRepublish.publishedAt, '2026-02-10T08:30:00.000Z');

const restoresFromOriginal = applyPublishedAtOnPublish(
  { _status: 'published' },
  {
    _status: 'draft',
    publishedAt: '2026-01-15T12:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
);
assert.equal(restoresFromOriginal.publishedAt, '2026-01-15T12:00:00.000Z');

const republishAfterClear = applyPublishedAtOnPublish(
  { _status: 'published', publishedAt: null },
  {
    _status: 'published',
    publishedAt: '2026-01-15T12:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
);
assert.equal(republishAfterClear.publishedAt, '2026-01-15T12:00:00.000Z');

const keepsExplicit = applyPublishedAtOnPublish(
  { _status: 'published', publishedAt: '2026-02-01T00:00:00.000Z' },
  { _status: 'draft' },
);
assert.equal(keepsExplicit.publishedAt, '2026-02-01T00:00:00.000Z');

assert.equal(
  resolvePublishedAtForPublishedPost(
    { publishedAt: null },
    { publishedAt: '2026-01-15T12:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' },
  ),
  '2026-01-15T12:00:00.000Z',
);

const draftSave = applyPublishedAtOnPublish(
  { _status: 'draft' },
  { _status: 'draft' },
  { skip: false },
);
assert.equal(draftSave.publishedAt, undefined);

const skippedAutosave = applyPublishedAtOnPublish(
  { _status: 'published' },
  { _status: 'draft' },
  { skip: true },
);
assert.equal(skippedAutosave.publishedAt, undefined);

const hookOut = setPublishedAtOnPublish({
  data: { _status: 'published' },
  originalDoc: { _status: 'draft', createdAt },
  req: req(),
  operation: 'update',
  collection: {} as never,
  context: {},
}) as { _status?: string; publishedAt?: string };
assert.ok(hookOut.publishedAt);
assert.notEqual(hookOut.publishedAt, createdAt);

const hookAutosave = setPublishedAtOnPublish({
  data: { _status: 'published' },
  originalDoc: { _status: 'draft' },
  req: req({ autosave: 'true' }),
  operation: 'update',
  collection: {} as never,
  context: {},
}) as { publishedAt?: string };
assert.equal(hookAutosave.publishedAt, undefined);

console.log('cms/src/hooks/setPublishedAtOnPublish.test.ts ok');
