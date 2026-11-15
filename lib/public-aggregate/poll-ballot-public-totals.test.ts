import assert from 'node:assert/strict';
import {
  publicPollBallotInitialTotals,
  publicPollBallotPerChoiceCountsHidden,
  publicPollBallotTotalsContainPerChoiceCounts,
} from '@/lib/public-aggregate/poll-ballot-public-totals';

const rawLow = { ja: 2, nei: 1, blank: 0, total: 3 };
const forBallot = publicPollBallotInitialTotals(rawLow);

assert.equal(publicPollBallotPerChoiceCountsHidden(rawLow), true);
assert.equal(publicPollBallotTotalsContainPerChoiceCounts(forBallot), false);
assert.equal(forBallot.ja, 0);
assert.equal(forBallot.nei, 0);
assert.equal(forBallot.blank, 0);
assert.equal(forBallot.total, 3);

const rawOk = { ja: 3, nei: 2, blank: 0, total: 5 };
const forBallotOk = publicPollBallotInitialTotals(rawOk);
assert.equal(publicPollBallotPerChoiceCountsHidden(rawOk), false);
assert.equal(forBallotOk.ja, 3);
assert.equal(publicPollBallotTotalsContainPerChoiceCounts(forBallotOk), true);

console.log('lib/public-aggregate/poll-ballot-public-totals.test.ts: ok');