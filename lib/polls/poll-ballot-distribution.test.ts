import assert from 'node:assert/strict';
import { pollBallotPercents } from '@/lib/polls/format';

const ties = pollBallotPercents({ nei: 2, blank: 2, ja: 2, total: 6 });
assert.deepEqual(
  [ties.nei, ties.blank, ties.ja],
  [34, 33, 33],
  'largest-remainder ties sum to 100 (nei/blank/ja order)',
);

const below = pollBallotPercents({ nei: 1, blank: 1, ja: 1, total: 3 });
assert.equal(below.ja, null, 'below MIN_PUBLIC_AGGREGATE_N hides percents');

console.log('lib/polls/poll-ballot-distribution.test.ts: ok');