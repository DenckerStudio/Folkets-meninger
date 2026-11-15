import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pollBallotPercents } from '@/lib/polls/format';

const ties = pollBallotPercents({ nei: 2, blank: 2, ja: 2, total: 6 });
assert.deepEqual(
  [ties.nei, ties.blank, ties.ja],
  [34, 33, 33],
  'largest-remainder ties sum to 100 (nei/blank/ja order)',
);

const below = pollBallotPercents({ nei: 1, blank: 1, ja: 1, total: 3 });
assert.equal(below.ja, null, 'below MIN_PUBLIC_AGGREGATE_N hides percents');

const barSrc = readFileSync(
  join(process.cwd(), 'components/polls/poll-ballot-distribution-bar.tsx'),
  'utf8',
);
const pollBallotSrc = readFileSync(join(process.cwd(), 'components/polls/poll-ballot.tsx'), 'utf8');
const pollCardSrc = readFileSync(join(process.cwd(), 'components/polls/poll-card.tsx'), 'utf8');

if (!barSrc.includes('showResultsBeforeVote = false')) {
  throw new Error('ballot bar defaults showResultsBeforeVote to false');
}
if (!barSrc.includes('ballotShouldShowDistribution')) {
  throw new Error('interactive bar reveals after vote');
}
if (!pollBallotSrc.includes('showResultsBeforeVote')) {
  throw new Error('dashboard poll ballot passes showResultsBeforeVote true');
}
if (!pollCardSrc.includes('showResultsBeforeVote')) {
  throw new Error('poll card passes showResultsBeforeVote true');
}
const layoutSrc = readFileSync(
  join(process.cwd(), 'lib/polls/ballot-distribution-layout.ts'),
  'utf8',
);
if (!layoutSrc.includes('BALLOT_SEGMENT_MIN_WIDTH_REM = 5.5')) {
  throw new Error('ballot bar sets segment min width');
}
if (!layoutSrc.includes('return totals[choice]')) {
  throw new Error('proportional flex uses raw counts not max(count,1)');
}
if (!barSrc.includes('prosent')) {
  throw new Error('ballot bar aria-label uses prosent');
}
if (barSrc.includes('truncate')) {
  throw new Error('ballot bar must not truncate choice labels');
}
if (!barSrc.includes('role="img"')) {
  throw new Error('read-only bar needs role=img a11y');
}
if (!barSrc.includes('figcaption')) {
  throw new Error('read-only bar needs visible text summary');
}

console.log('lib/polls/poll-ballot-distribution.test.ts: ok');