import assert from 'node:assert/strict';
import {
  documentKindsToRpcFilter,
  parseTopicAroundDocumentKinds,
  parseTopicAroundPeriod,
  parseTopicAroundSort,
  periodToPublishedAfter,
  shouldShowPublicTopicAroundSection,
} from './topic-around-filters';

assert.deepEqual(
  [...(documentKindsToRpcFilter(['innstilling', 'lovforslag']) ?? [])].sort(),
  ['innstilling', 'inns', 'lovforslag', 'prop', 'proposisjon'].sort(),
);
assert.equal(documentKindsToRpcFilter([]), null);
assert.equal(parseTopicAroundSort('date'), 'date');
assert.equal(parseTopicAroundSort('nonsense'), 'relevance');
assert.equal(parseTopicAroundPeriod('24m'), '24m');
assert.equal(parseTopicAroundPeriod(''), 'all');
assert.deepEqual(parseTopicAroundDocumentKinds('innstilling,lovforslag'), [
  'lovforslag',
  'innstilling',
]);
assert.equal(parseTopicAroundDocumentKinds('bogus'), null);

const publishedAfter = periodToPublishedAfter('12m');
assert.ok(publishedAfter);
assert.ok(Date.parse(publishedAfter!) < Date.now());
assert.equal(periodToPublishedAfter('all'), null);

assert.equal(shouldShowPublicTopicAroundSection(4), false);
assert.equal(shouldShowPublicTopicAroundSection(5), true);

console.log('lib/search/topic-around-filters.test.ts: ok');