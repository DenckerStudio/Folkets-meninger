import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  pollDistributionRevealAllowed,
  redactPollTotalsForViewer,
  shouldShowPollDistributionAwaitingNote,
  POLL_DISTRIBUTION_AWAITING_AGGREGATE_MESSAGE,
} from '@/lib/polls/poll-distribution-reveal';
import { ballotShouldShowDistribution } from '@/lib/polls/ballot-distribution-layout';

const atK = { ja: 3, nei: 2, blank: 0, total: 5 };
const belowK = { ja: 2, nei: 1, blank: 0, total: 3 };

assert.equal(pollDistributionRevealAllowed(true, false, atK), false, 'åpen, ikke stemt — skjult');
assert.equal(pollDistributionRevealAllowed(true, true, atK), true, 'åpen, stemt, k≥5 — vist');
assert.equal(pollDistributionRevealAllowed(true, true, belowK), false, 'åpen, stemt, <k — skjult');
assert.equal(pollDistributionRevealAllowed(false, false, atK), true, 'avsluttet, ikke stemt — vist');
assert.equal(pollDistributionRevealAllowed(false, false, belowK), false, 'avsluttet, <k — skjult');
assert.equal(pollDistributionRevealAllowed(false, true, atK), true, 'avsluttet, stemt — vist');

assert.equal(ballotShouldShowDistribution(atK, true, false), false, 'åpen+ikke stemt');
assert.equal(ballotShouldShowDistribution(atK, true, true), true, 'åpen+stemt≥k');
assert.equal(ballotShouldShowDistribution(belowK, true, true), false, 'åpen+stemt<k');
assert.equal(ballotShouldShowDistribution(atK, false, false), true, 'avsluttet for alle≥k');

const openNoVote = redactPollTotalsForViewer(atK, true, false);
assert.deepEqual(openNoVote, { ja: 0, nei: 0, blank: 0, total: 5 });

const closedNoVote = redactPollTotalsForViewer(atK, false, false);
assert.deepEqual(closedNoVote, atK);

const openVoted = redactPollTotalsForViewer(atK, true, true);
assert.deepEqual(openVoted, atK);

assert.equal(shouldShowPollDistributionAwaitingNote(true, true, belowK), true, 'stemt <k: vis melding');
assert.equal(shouldShowPollDistributionAwaitingNote(false, false, belowK), true, 'avsluttet <k: vis melding');
assert.equal(shouldShowPollDistributionAwaitingNote(true, false, belowK), false, 'åpen ikke stemt: ingen k-melding');
assert.match(POLL_DISTRIBUTION_AWAITING_AGGREGATE_MESSAGE, /minst 5/);

const pollCardSrc = readFileSync(
  join(process.cwd(), 'components/polls/poll-card.tsx'),
  'utf8',
);
if (!pollCardSrc.includes('showOpenStemCountOnly')) {
  throw new Error('poll card shows stem count for open non-voters');
}

console.log('lib/polls/poll-distribution-reveal.test.ts: ok');