import assert from 'node:assert/strict';
import { OPINION_BODY_MIN, OPINION_POINT_TEXT_MAX } from './types';
import {
  describeOpinionComposerGaps,
  emptyOpinionPointDrafts,
  hasOpinionFieldErrors,
  isOpinionCreateStance,
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
assert.equal(isOpinionCreateStance('for'), true);
assert.equal(isOpinionCreateStance('imot'), true);
assert.equal(isOpinionCreateStance('blank'), false);

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

const okBlankDraft = validateOpinionDraft({
  title: 'Kollektivtilbud i distriktene',
  body: '',
  stance: 'blank',
  points,
});
assert.ok(okBlankDraft.stance);
assert.equal(okBlankDraft.body, undefined);

const blankTooLong = validateOpinionDraft({
  title: 'Kollektivtilbud i distriktene',
  body: 'x'.repeat(4001),
  stance: 'blank',
  points,
});
assert.ok(blankTooLong.body);
assert.ok(blankTooLong.stance);

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

const okBlankReply = validateReplyDraft({ body: '', stance: 'blank' });
assert.deepEqual(okBlankReply, {});


assert.equal(OPINION_POINT_TEXT_MAX, 280);
assert.equal(OPINION_BODY_MIN, 250);

const point280 = 'p'.repeat(280);
const atPointMax = validateOpinionPoints([
  { stance: 'for', text: point280 },
  { stance: 'imot', text: 'Kostnaden kan bli høy uten tydelig finansiering.' },
  { stance: 'for', text: 'Klimamålene nås raskere med buss og tog.' },
]);
assert.equal(atPointMax.error, undefined);

const overPointMax = validateOpinionPoints([
  { stance: 'for', text: 'p'.repeat(281) },
  { stance: 'imot', text: 'Kostnaden kan bli høy uten tydelig finansiering.' },
  { stance: 'for', text: 'Klimamålene nås raskere med buss og tog.' },
]);
assert.match(overPointMax.error ?? '', /280/);

const basePoints = [
  { stance: 'for', text: 'Bedre kollektiv gir flere reisende i distriktene.' },
  { stance: 'imot', text: 'Kostnaden kan bli høy uten tydelig finansiering.' },
  { stance: 'for', text: 'Klimamålene nås raskere med buss og tog.' },
];

const allMissing = describeOpinionComposerGaps({
  issueId: null,
  stance: null,
  body: '',
  points: emptyOpinionPointDrafts(),
});
assert.match(allMissing, /Velg en sak, deretter For eller Imot/);
assert.match(allMissing, /250 tegn igjen til minstekravet/);
assert.match(allMissing, /minst ett punkt for og ett punkt imot/);
assert.doesNotMatch(allMissing, /under 12/);

const ready = describeOpinionComposerGaps({
  issueId: 'sak-1',
  stance: 'for',
  body: 'x'.repeat(250),
  points: basePoints,
});
assert.equal(ready, '');

const bodyLeft = describeOpinionComposerGaps({
  issueId: 'sak-1',
  stance: 'imot',
  body: 'x'.repeat(249),
  points: basePoints,
});
assert.equal(bodyLeft, '1 tegn igjen til minstekravet.');
assert.doesNotMatch(bodyLeft, /sak/);
assert.doesNotMatch(bodyLeft, /For eller Imot/);

const needsImot = describeOpinionComposerGaps({
  issueId: 'sak-1',
  stance: 'for',
  body: 'x'.repeat(250),
  points: [
    { stance: 'for', text: 'Bedre kollektiv gir flere reisende i distriktene.' },
    { stance: 'for', text: 'Kort punkt' },
    { stance: 'for', text: 'Klimamålene nås raskere med buss og tog.' },
  ],
});
assert.match(needsImot, /Ta med minst ett punkt imot/);
assert.match(needsImot, /Ett kulepunkt er under 12 tegn/);
assert.doesNotMatch(needsImot, /punkt for og/);

const twoShort = describeOpinionComposerGaps({
  issueId: 'sak-1',
  stance: 'for',
  body: 'x'.repeat(250),
  points: [
    { stance: 'for', text: 'Kort for' },
    { stance: 'imot', text: 'Kort imot' },
    { stance: 'for', text: 'Klimamålene nås raskere med buss og tog.' },
  ],
});
assert.match(twoShort, /2 kulepunkter er under 12 tegn/);
assert.match(twoShort, /Ta med minst ett punkt imot/);
assert.doesNotMatch(twoShort, /punkt for og/);

console.log('opinions/validate.test.ts: ok');
