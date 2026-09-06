import assert from 'node:assert/strict';
import { checkDiscussionContent } from './content-check';

assert.deepEqual(checkDiscussionContent('   '), {
  approved: false,
  category: 'other',
  reason: 'Innholdet kan ikke være tomt',
});

assert.deepEqual(checkDiscussionContent('Dette er et saklig innlegg om saken.'), {
  approved: true,
});

assert.equal(checkDiscussionContent('nazi propaganda her').approved, false);
assert.equal(checkDiscussionContent('alle muslimer er ...').approved, false);
assert.equal(checkDiscussionContent('se pornhub').approved, false);
assert.equal(checkDiscussionContent('drep alle politikere').approved, false);
assert.equal(checkDiscussionContent('kjøp nå gratis penger').approved, false);

console.log('content-check.test.ts: ok');
