import assert from 'node:assert/strict';
import {
  SUGGESTION_BODY_MAX,
  SUGGESTION_BODY_MIN,
  SUGGESTION_TITLE_MIN,
} from '@/lib/appens-fremtid/constants';
import {
  normalizeText,
  validateChangelogInput,
  validateRoadmapInput,
  validateSuggestionBody,
  validateSuggestionInput,
  validateSuggestionTitle,
} from '@/lib/appens-fremtid/validate';

assert.equal(normalizeText('  hei  '), 'hei');
assert.equal(normalizeText(null), '');

assert.equal(validateSuggestionTitle('kort'), `Tittelen må være minst ${SUGGESTION_TITLE_MIN} tegn.`);
assert.equal(validateSuggestionBody('kort'), `Beskrivelsen må være minst ${SUGGESTION_BODY_MIN} tegn.`);
assert.equal(validateSuggestionBody('x'.repeat(SUGGESTION_BODY_MAX + 1)), `Beskrivelsen kan være maks ${SUGGESTION_BODY_MAX} tegn.`);

const okSuggestion = validateSuggestionInput({
  title: 'Bedre varsling',
  body: 'Jeg vil kunne velge hvilke saker jeg får e-post om.',
  category: 'funksjon',
  audience: 'innloggede',
});
assert.equal('error' in okSuggestion, false);

const badCategory = validateSuggestionInput({
  title: 'Bedre varsling',
  body: 'Jeg vil kunne velge hvilke saker jeg får e-post om.',
  category: 'nei',
  audience: 'alle',
});
assert.deepEqual(badCategory, { error: 'Velg en kategori.' });

const okChangelog = validateChangelogInput({
  title: 'Ny side',
  body: 'Appens fremtid er på plass.',
});
assert.equal('error' in okChangelog, false);

const okRoadmap = validateRoadmapInput({
  title: 'Mørk modus',
  body: 'Vi justerer farger og kontrast.',
  status: 'in_progress',
});
assert.equal('error' in okRoadmap, false);

const badRoadmap = validateRoadmapInput({
  title: 'Mørk modus',
  body: 'Vi justerer farger og kontrast.',
  status: 'soon',
});
assert.deepEqual(badRoadmap, { error: 'Velg en status.' });

console.log('appens-fremtid/validate.test.ts: ok');
