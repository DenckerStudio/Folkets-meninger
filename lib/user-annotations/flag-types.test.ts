import assert from 'node:assert/strict';
import {
  DEFAULT_USER_ANNOTATION_FLAG_TYPE,
  USER_ANNOTATION_FLAG_LABELS,
  USER_ANNOTATION_FLAG_TYPES,
  isUserAnnotationFlagType,
} from '@/lib/user-annotations/flag-types';

assert.equal(DEFAULT_USER_ANNOTATION_FLAG_TYPE, 'viktig_argument');
assert.equal(USER_ANNOTATION_FLAG_TYPES.length, 5);
assert.equal(USER_ANNOTATION_FLAG_LABELS.faktasjekk, 'Faktasjekk');
assert.equal(USER_ANNOTATION_FLAG_LABELS.kildesok, 'Kildesøk');
assert.equal(USER_ANNOTATION_FLAG_LABELS.sporsmal, 'Spørsmål');
assert.equal(isUserAnnotationFlagType('motargument'), true);
assert.equal(isUserAnnotationFlagType('ukjent'), false);

console.log('user-annotations/flag-types.test.ts: ok');