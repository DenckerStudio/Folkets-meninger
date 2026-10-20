import assert from 'node:assert/strict';
import type { PayloadRequest } from 'payload';
import {
  detectContentFeedbackTransition,
  isDraftOrAutosaveSave,
  readMainDocSnapshot,
  recordMainDocSnapshot,
} from './contentFeedbackWebhook';

function req(query: Record<string, unknown> = {}): PayloadRequest {
  return { query, context: {} } as PayloadRequest;
}

assert.equal(isDraftOrAutosaveSave(req({ draft: 'true' })), true);
assert.equal(isDraftOrAutosaveSave(req({ autosave: 'true' })), true);
assert.equal(isDraftOrAutosaveSave(req({})), false);

const publish = detectContentFeedbackTransition('draft', 'published');
assert.equal(publish.becamePublished, true);
assert.equal(publish.becameArchived, false);

const unpublish = detectContentFeedbackTransition('published', 'draft');
assert.equal(unpublish.becameArchived, true);

const updateReq = req();
recordMainDocSnapshot(updateReq, '42', { status: 'published', origin: 'n8n' });
assert.deepEqual(readMainDocSnapshot(updateReq, '42', 'update'), {
  status: 'published',
  origin: 'n8n',
});

const createReq = req();
createReq.context.contentFeedbackCreateOrigin = 'n8n';
assert.deepEqual(readMainDocSnapshot(createReq, '99', 'create'), {
  status: 'draft',
  origin: 'n8n',
});

console.log('cms/src/hooks/contentFeedbackWebhook.test.ts ok');
