import assert from 'node:assert/strict';
import { isDraftOrAutosaveSave } from './contentFeedbackWebhook';

function req(query: Record<string, unknown>) {
  return { query } as never;
}

assert.equal(isDraftOrAutosaveSave(req({ draft: 'true' })), true);
assert.equal(isDraftOrAutosaveSave(req({ autosave: 'true' })), true);
assert.equal(isDraftOrAutosaveSave(req({})), false);

console.log('cms/src/hooks/contentFeedbackWebhook.test.ts ok');
