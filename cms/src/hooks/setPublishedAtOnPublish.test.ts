import assert from 'node:assert/strict';
import type { PayloadRequest } from 'payload';
import {
  applyPublishedAtOnPublish,
  isAutosaveRequest,
  isDraftContentSave,
  setPublishedAtOnPublish,
} from './setPublishedAtOnPublish';

function req(query: Record<string, unknown> = {}): PayloadRequest {
  return { query } as unknown as PayloadRequest;
}

assert.equal(isAutosaveRequest(req({ autosave: 'true' })), true);
assert.equal(isDraftContentSave({ _status: 'draft' }, req()), true);

const transition = applyPublishedAtOnPublish(
  { _status: 'published' },
  { _status: 'draft' },
);
assert.equal(transition._status, 'published');
assert.ok(typeof transition.publishedAt === 'string' && transition.publishedAt.length > 0);

const keepsExisting = applyPublishedAtOnPublish(
  { _status: 'published' },
  { _status: 'draft', publishedAt: '2026-01-15T12:00:00.000Z' },
);
assert.equal(keepsExisting.publishedAt, undefined);

const keepsExplicit = applyPublishedAtOnPublish(
  { _status: 'published', publishedAt: '2026-02-01T00:00:00.000Z' },
  { _status: 'draft' },
);
assert.equal(keepsExplicit.publishedAt, '2026-02-01T00:00:00.000Z');

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
  originalDoc: { _status: 'draft' },
  req: req(),
  operation: 'update',
  collection: {} as never,
  context: {},
}) as { _status?: string; publishedAt?: string };
assert.ok(hookOut.publishedAt);

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
