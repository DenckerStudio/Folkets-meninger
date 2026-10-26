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

const boldKilderNoColon = `Svar her.

**Kilder**
[1] Prop. 1 L`;
const boldNoColonSplit = splitAnswerBodyAndSourcesFooter(boldKilderNoColon);
assert.match(boldNoColonSplit.footer, /\*\*Kilder\*\*/);

const boldKilderColonOutside = `Svar her.

**Kilder**: [1] x`;
const boldOutsideSplit = splitAnswerBodyAndSourcesFooter(boldKilderColonOutside);
assert.match(boldOutsideSplit.footer, /^Kilder:\n\[1\] x$/);

const headingKilder = `Svar her.

### Kilder
[1] Prop. 1 L`;
const headingSplit = splitAnswerBodyAndSourcesFooter(headingKilder);
assert.match(headingSplit.footer, /Kilder/);

const inlineKilder = `Svar her.

Kilder: [1] Prop. 1 L`;
const inlineSplit = splitAnswerBodyAndSourcesFooter(inlineKilder);
assert.match(inlineSplit.footer, /\[1\] Prop\. 1 L/);

const kilderInProse = `Svar her.

Kilder sier ulikt om dette.`;
const proseSplit = splitAnswerBodyAndSourcesFooter(kilderInProse);
assert.equal(proseSplit.footer, '');
assert.match(proseSplit.body, /Kilder sier ulikt om dette/);

console.log('lib/chat/grounded-answer-structure.test.ts ok');
