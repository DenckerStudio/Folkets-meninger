import assert from 'node:assert/strict';
import { formatStemmerCount } from './norwegian-plural';

assert.equal(formatStemmerCount(0), '0 stemmer');
assert.equal(formatStemmerCount(1), '1 stemme');
assert.equal(formatStemmerCount(2), '2 stemmer');

console.log('norwegian-plural.test.ts: ok');
