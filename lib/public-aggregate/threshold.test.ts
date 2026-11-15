import assert from 'node:assert/strict';
import { MIN_PUBLIC_AGGREGATE_N } from '@/lib/public-aggregate/constants';
import {
  folkPublicBreakdownRedacted,
  publicAggregateMeetsThreshold,
  publicAggregateVotesRemaining,
  suppressPublicAggregateBreakdown,
} from '@/lib/public-aggregate/threshold';

assert.equal(MIN_PUBLIC_AGGREGATE_N, 5);

assert.equal(publicAggregateMeetsThreshold(4), false);
assert.equal(publicAggregateMeetsThreshold(5), true);
assert.equal(publicAggregateMeetsThreshold(99), true);
assert.equal(publicAggregateMeetsThreshold(-1), false);
assert.equal(publicAggregateMeetsThreshold(Number.NaN), false);

assert.equal(folkPublicBreakdownRedacted(0), false);
assert.equal(folkPublicBreakdownRedacted(3), true);
assert.equal(folkPublicBreakdownRedacted(5), false);

assert.equal(publicAggregateVotesRemaining(0), 5);
assert.equal(publicAggregateVotesRemaining(3), 2);
assert.equal(publicAggregateVotesRemaining(5), 0);
assert.equal(publicAggregateVotesRemaining(12), 0);

const full = suppressPublicAggregateBreakdown(
  { for: 3, against: 1, abstain: 1, total: 5 },
  ['for', 'against', 'abstain'],
);
assert.equal(full.for, 3);
assert.equal(full.against, 1);

const suppressed = suppressPublicAggregateBreakdown(
  { for: 2, against: 1, abstain: 0, total: 3 },
  ['for', 'against', 'abstain'],
);
assert.equal(suppressed.for, 0);
assert.equal(suppressed.against, 0);
assert.equal(suppressed.abstain, 0);
assert.equal(suppressed.total, 3);

console.log('lib/public-aggregate/threshold.test.ts: ok');