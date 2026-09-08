import assert from 'node:assert/strict';
import {
  emptyOpinionPointDrafts,
  hasOpinionFieldErrors,
  isOpinionStance,
  parseOpinionPoints,
  validateOpinionDraft,
  validateOpinionPoints,
  validateReplyDraft,
} from './validate';

assert.equal(isOpinionStance('for'), true);
assert.equal(isOpinionStance('blank'), true);
assert.equal(isOpinionStance('imot'), true);
assert.equal(isOpinionStance('against'), false);
assert.equal(isOpinionStance('ja'), false);

const points = [
  { stance: 'for', text: 'Bedre kollektiv gir flere reisende i distriktene.' },
  { stance: 'imot', text: 'Kostnaden kan bli høy uten tydelig finansiering.' },
  { stance: 'for', text: 'Klimamålene nås raskere med buss og tog.' },
];

const shortDraft = validateOpinionDraft({
  title: 'Hei',
  body: 'For kort.',
  stance: 'for',
  points,
});
assert.ok(shortDraft.title);
assert.ok(shortDraft.body);
assert.equal(shortDraft.stance, undefined);
assert.equal(shortDraft.points, undefined);
assert.equal(hasOpinionFieldErrors(shortDraft), true);

const longEnough = 'x'.repeat(250);
const okDraft = validateOpinionDraft({
  title: 'Kollektivtilbud i distriktene',
  body: longEnough,
  stance: 'imot',
  points,
});
assert.deepEqual(okDraft, {});
assert.equal(hasOpinionFieldErrors(okDraft), false);

const missingStance = validateOpinionDraft({
  title: 'Kollektivtilbud i distriktene',
  body: longEnough,
  stance: 'maybe',
  points,
});
assert.ok(missingStance.stance);

const missingPoints = validateOpinionDraft({
  title: 'Kollektivtilbud i distriktene',
  body: longEnough,
  stance: 'for',
});
assert.ok(missingPoints.points);

const onlyFor = validateOpinionPoints([
  { stance: 'for', text: 'Bedre kollektiv gir flere reisende i distriktene.' },
  { stance: 'for', text: 'Klimamålene nås raskere med buss og tog.' },
  { stance: 'for', text: 'Barn og eldre får enklere hverdag uten bil.' },
]);
assert.ok(onlyFor.error);

assert.equal(emptyOpinionPointDrafts().length, 3);
assert.equal(parseOpinionPoints([{ stance: 'blank', text: 'ikke gyldig' }]).length, 0);

const shortReply = validateReplyDraft({ body: 'for kort', stance: 'for' });
assert.ok(shortReply.body);

const okReply = validateReplyDraft({ body: 'y'.repeat(80), stance: 'blank' });
assert.deepEqual(okReply, {});

console.log('opinions/validate.test.ts: ok');
