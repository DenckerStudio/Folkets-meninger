import assert from 'node:assert/strict';
import {
  ballotSegmentFlexGrow,
  ballotShouldShowDistribution,
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

assert.equal(
  ballotShouldShowDistribution({ ja: 3, nei: 2, blank: 0, total: 5 }, true, false),
  false,
  'åpen: skjult før stemme',
);
assert.equal(
  ballotShouldShowDistribution({ ja: 2, nei: 1, blank: 0, total: 3 }, true, true),
  false,
  'åpen: under k=5 skjules tall selv etter stemme',
);
assert.equal(
  ballotShouldShowDistribution({ ja: 3, nei: 2, blank: 0, total: 5 }, true, true),
  true,
  'åpen: etter stemme ved k>=5',
);
assert.equal(
  ballotShouldShowDistribution({ ja: 3, nei: 2, blank: 0, total: 5 }, false, false),
  true,
  'avsluttet: vist for alle ved k>=5',
);

console.log('lib/polls/ballot-distribution-layout.test.ts: ok');