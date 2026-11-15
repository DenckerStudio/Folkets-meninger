import assert from 'node:assert/strict';
import {
  pollDistributionRevealAllowed,
  redactPollTotalsForViewer,
} from '@/lib/polls/poll-distribution-reveal';
import { ballotShouldShowDistribution } from '@/lib/polls/ballot-distribution-layout';

const atK = { ja: 3, nei: 2, blank: 0, total: 5 };
const belowK = { ja: 2, nei: 1, blank: 0, total: 3 };

assert.equal(pollDistributionRevealAllowed(false, atK), false, 'ikke stemt — skjult');
assert.equal(pollDistributionRevealAllowed(false, belowK), false, 'ikke stemt åpen — skjult');
assert.equal(pollDistributionRevealAllowed(true, atK), true, 'stemt ved k≥5 — vist');
assert.equal(pollDistributionRevealAllowed(true, belowK), false, 'stemt under k — skjult');

assert.equal(
  ballotShouldShowDistribution(atK, false),
  false,
  'åpen, ikke stemt',
);
assert.equal(
  ballotShouldShowDistribution(atK, true),
  true,
  'åpen, stemt, k≥5',
);
assert.equal(
  ballotShouldShowDistribution(belowK, true),
  false,
  'stemt under terskel',
);

const redacted = redactPollTotalsForViewer(atK, false);
assert.deepEqual(redacted, { ja: 0, nei: 0, blank: 0, total: 5 });

const full = redactPollTotalsForViewer(atK, true);
assert.deepEqual(full, atK);

console.log('lib/polls/poll-distribution-reveal.test.ts: ok');