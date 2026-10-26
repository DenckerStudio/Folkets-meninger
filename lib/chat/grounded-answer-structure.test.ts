import assert from 'node:assert/strict';
import { splitAnswerBodyAndSourcesFooter, joinAnswerBodyAndSourcesFooter } from './grounded-answer-structure';

const sample = `Kort svar her.

- punkt a
- punkt b

Kilder:
[1] Prop. 1 L`;

const { body, footer } = splitAnswerBodyAndSourcesFooter(sample);
assert.match(body, /punkt a/);
assert.ok(!body.includes('Kilder:'));
assert.match(footer, /^Kilder:\n\[1\]/);

const roundTrip = joinAnswerBodyAndSourcesFooter(body, footer);
assert.equal(roundTrip, sample);

console.log('lib/chat/grounded-answer-structure.test.ts ok');
