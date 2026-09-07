import assert from 'node:assert/strict';
import {
  hasOpinionFieldErrors,
  isOpinionStance,
  validateOpinionDraft,
  validateReplyDraft,
} from './validate';

assert.equal(isOpinionStance('for'), true);
assert.equal(isOpinionStance('blank'), true);
assert.equal(isOpinionStance('imot'), true);
assert.equal(isOpinionStance('against'), false);
assert.equal(isOpinionStance('ja'), false);

const shortDraft = validateOpinionDraft({
  title: 'Hei',
  body: 'For kort.',
  stance: 'for',
});
assert.ok(shortDraft.title);
assert.ok(shortDraft.body);
assert.equal(shortDraft.stance, undefined);
assert.equal(hasOpinionFieldErrors(shortDraft), true);

const longEnough = 'x'.repeat(250);
const okDraft = validateOpinionDraft({
  title: 'Kollektivtilbud i distriktene',
  body: longEnough,
  stance: 'imot',
});
assert.deepEqual(okDraft, {});
assert.equal(hasOpinionFieldErrors(okDraft), false);

const missingStance = validateOpinionDraft({
  title: 'Kollektivtilbud i distriktene',
  body: longEnough,
  stance: 'maybe',
});
assert.ok(missingStance.stance);

const shortReply = validateReplyDraft({ body: 'for kort', stance: 'for' });
assert.ok(shortReply.body);

const okReply = validateReplyDraft({ body: 'y'.repeat(80), stance: 'blank' });
assert.deepEqual(okReply, {});

console.log('opinions/validate.test.ts: ok');
