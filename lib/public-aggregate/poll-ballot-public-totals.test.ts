import assert from 'node:assert/strict';
import {
  publicPollBallotInitialTotals,
  publicPollBallotPerChoiceCountsHidden,
  publicPollBallotTotalsContainPerChoiceCounts,
} from '@/lib/public-aggregate/poll-ballot-public-totals';

const rawLow = { ja: 2, nei: 1, blank: 0, total: 3 };
const openVotedLow = publicPollBallotInitialTotals(rawLow, true, true);
assert.equal(publicPollBallotPerChoiceCountsHidden(rawLow, true, true), true);
assert.equal(publicPollBallotTotalsContainPerChoiceCounts(openVotedLow), false);
assert.deepEqual(openVotedLow, { ja: 0, nei: 0, blank: 0, total: 3 });

const rawOk = { ja: 3, nei: 2, blank: 0, total: 5 };
const openNotVoted = publicPollBallotInitialTotals(rawOk, true, false);
assert.equal(publicPollBallotPerChoiceCountsHidden(rawOk, true, false), true);
assert.deepEqual(openNotVoted, { ja: 0, nei: 0, blank: 0, total: 5 });

const closedNotVoted = publicPollBallotInitialTotals(rawOk, false, false);
assert.equal(publicPollBallotPerChoiceCountsHidden(rawOk, false, false), false);
assert.deepEqual(closedNotVoted, rawOk);

const openVotedOk = publicPollBallotInitialTotals(rawOk, true, true);
assert.equal(publicPollBallotPerChoiceCountsHidden(rawOk, true, true), false);
assert.deepEqual(openVotedOk, rawOk);

console.log('lib/public-aggregate/poll-ballot-public-totals.test.ts: ok');