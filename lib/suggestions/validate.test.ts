import assert from 'node:assert/strict';
import { SUGGESTION_BODY_MAX, SUGGESTION_BODY_MIN } from '@/lib/suggestions/constants';
import { normalizeSuggestionBody, validateSuggestionBody } from '@/lib/suggestions/validate';

assert.equal(normalizeSuggestionBody('  hei  '), 'hei');
assert.equal(normalizeSuggestionBody(null), '');
assert.equal(normalizeSuggestionBody(12), '');

assert.equal(
  validateSuggestionBody('kort'),
  `Beskrivelsen må være minst ${SUGGESTION_BODY_MIN} tegn.`,
);
assert.equal(
  validateSuggestionBody('x'.repeat(SUGGESTION_BODY_MAX + 1)),
  `Beskrivelsen kan være maks ${SUGGESTION_BODY_MAX} tegn.`,
);
assert.equal(validateSuggestionBody('x'.repeat(SUGGESTION_BODY_MIN)), null);
assert.equal(validateSuggestionBody('x'.repeat(SUGGESTION_BODY_MAX)), null);

console.log('suggestions/validate.test.ts: ok');
