import assert from 'node:assert/strict';
import { buildOpinionReelQuestion, OPINION_REEL_MIN_ENGAGEMENT } from './reel-question';

assert.equal(OPINION_REEL_MIN_ENGAGEMENT, 5);

assert.equal(
  buildOpinionReelQuestion({
    title: 'Tittel',
    points: [
      { stance: 'imot', text: 'Imot-poeng' },
      { stance: 'for', text: 'For-poeng her' },
    ],
  }),
  'Er du enig: «For-poeng her»?',
);

assert.equal(
  buildOpinionReelQuestion({ title: 'Bare tittel', points: [] }),
  'Er du enig: «Bare tittel»?',
);

const long = 'a'.repeat(200);
const question = buildOpinionReelQuestion({
  title: 'T',
  points: [{ stance: 'for', text: long }],
});
assert.ok(question.length < 140, 'question should be truncated');
assert.ok(question.endsWith('»?'));
assert.ok(question.includes('…'));

console.log('reel-question tests passed');
