import assert from 'node:assert/strict';
import { addStanceCount, emptyStanceCounts, opinionSupportCount, stanceLabel } from './labels';

assert.equal(stanceLabel('for'), 'For');
assert.equal(stanceLabel('blank'), 'Blank');
assert.equal(stanceLabel('imot'), 'Imot');

// Supporters are the "for" replies — a blank/neutral reply is not support.
const counts = emptyStanceCounts();
addStanceCount(counts, 'for', 3);
addStanceCount(counts, 'blank', 4);
addStanceCount(counts, 'imot', 5);
assert.deepEqual(counts, { for: 3, blank: 4, imot: 5, total: 12 });
assert.equal(opinionSupportCount(counts), 3);
assert.notEqual(opinionSupportCount(counts), counts.total);

console.log('lib/opinions/labels.test.ts passed');
