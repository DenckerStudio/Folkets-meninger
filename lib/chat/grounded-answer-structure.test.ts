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

const markdownKilder = `Svar her.

**Kilder:**
[1] Prop. 1 L`;
const mdSplit = splitAnswerBodyAndSourcesFooter(markdownKilder);
assert.ok(!mdSplit.body.includes('Kilder'));
assert.match(mdSplit.footer, /\[1\] Prop\. 1 L/);

const headingKilder = `Svar her.

### Kilder
[1] Prop. 1 L`;
const headingSplit = splitAnswerBodyAndSourcesFooter(headingKilder);
assert.match(headingSplit.footer, /Kilder/);

const inlineKilder = `Svar her.

Kilder: [1] Prop. 1 L`;
const inlineSplit = splitAnswerBodyAndSourcesFooter(inlineKilder);
assert.match(inlineSplit.footer, /\[1\] Prop\. 1 L/);

console.log('lib/chat/grounded-answer-structure.test.ts ok');
