import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { publicPollBallotInitialTotals } from '@/lib/public-aggregate/poll-ballot-public-totals';
import { pollDistributionRevealAllowed } from '@/lib/polls/poll-distribution-reveal';

const atK = { ja: 10, nei: 5, blank: 2, total: 17 };

assert.equal(pollDistributionRevealAllowed(true, false, atK), false, 'sak/åpen: ikke stemt');
assert.equal(pollDistributionRevealAllowed(false, false, atK), true, 'sak/avsluttet: alle');
assert.deepEqual(
  publicPollBallotInitialTotals(atK, true, false),
  { ja: 0, nei: 0, blank: 0, total: 17 },
  'sak: kun total til ikke-stemmer på åpen',
);

const root = process.cwd();
const sakSrc = readFileSync(
  join(root, 'components/sak/sak-stortinget-poll-aggregate.tsx'),
  'utf8',
);
const tilesSrc = readFileSync(
  join(root, 'components/polls/poll-choice-result-tiles.tsx'),
  'utf8',
);

assert.match(sakSrc, /publicPollBallotInitialTotals\(totals,\s*votingOpen,\s*hasVoted\)/);
assert.match(sakSrc, /PollChoiceResultTiles[\s\S]*votingOpen=\{votingOpen\}/);
assert.match(sakSrc, /hasVoted=\{hasVoted\}/);
assert.doesNotMatch(sakSrc, /showBreakdown.*publicAggregateMeetsThreshold/);
assert.match(sakSrc, /sr-only[\s\S]*formatStemmerCount/);
assert.doesNotMatch(sakSrc, /totals\.ja|totals\.nei/);
assert.match(tilesSrc, /ballotShouldShowDistribution/);

console.log('lib/sak/sak-stortinget-poll-aggregate.reveal.test.ts: ok');