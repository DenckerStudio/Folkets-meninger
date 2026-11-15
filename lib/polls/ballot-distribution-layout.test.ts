import assert from 'node:assert/strict';
import {
  ballotSegmentFlexGrow,
  formatPollBallotDistributionSummary,
} from '@/lib/polls/ballot-distribution-layout';
import { pollBallotPercents } from '@/lib/polls/format';
import type { PollTotals } from '@/lib/polls/types';

const skewed: PollTotals = { nei: 30, blank: 10, ja: 60, total: 100 };

assert.equal(ballotSegmentFlexGrow(skewed, 'blank', true), 10);
assert.equal(ballotSegmentFlexGrow(skewed, 'nei', true), 30);
assert.equal(ballotSegmentFlexGrow({ ...skewed, blank: 0, total: 90 }, 'blank', true), 0);

const percents = pollBallotPercents(skewed);
assert.match(
  formatPollBallotDistributionSummary(skewed, percents, true),
  /Nei 30 %, Blank 10 %, Ja 60 %, 100 stemmer/,
);

console.log('lib/polls/ballot-distribution-layout.test.ts: ok');