import assert from 'node:assert/strict';
import { planQuickStanceRemoval, planQuickStanceSave, removalResponse } from './quick-stance';

const reply = 'Jeg er enig fordi '.padEnd(120, 'x');

// Stance + written reply → untap: the reply is kept, no error, nothing removed.
const withReply = { id: 'r1', stance: 'for', body: reply, is_removed: false };
const untap = planQuickStanceRemoval(withReply);
assert.deepEqual(untap, { action: 'keep-reply', replyId: 'r1', stance: 'for' });
assert.deepEqual(removalResponse(untap), {
  success: true,
  removed: false,
  keptReply: true,
  stance: 'for',
});

// Stance + written reply → tap again: the quick save must not wipe the body.
assert.deepEqual(planQuickStanceSave(withReply), { action: 'keep-reply', replyId: 'r1', stance: 'for' });

// Pure quick stance (empty body) → untap removes it.
const quick = { id: 'q1', stance: 'imot', body: '', is_removed: false };
assert.deepEqual(planQuickStanceRemoval(quick), { action: 'remove', replyId: 'q1' });
assert.equal(removalResponse(planQuickStanceRemoval(quick)).removed, true);
assert.deepEqual(planQuickStanceSave(quick), { action: 'save' });

// Whitespace-only body counts as a quick stance.
assert.equal(planQuickStanceRemoval({ ...quick, body: '   ' }).action, 'remove');

// Nothing there (or already removed) → idempotent no-op, never an error.
assert.deepEqual(planQuickStanceRemoval(null), { action: 'noop' });
assert.deepEqual(planQuickStanceRemoval({ ...withReply, is_removed: true }), { action: 'noop' });
assert.equal(removalResponse({ action: 'noop' }).success, true);
assert.deepEqual(planQuickStanceSave(null), { action: 'save' });
assert.deepEqual(planQuickStanceSave({ ...withReply, is_removed: true }), { action: 'save' });

console.log('opinions/quick-stance.test.ts: ok');
