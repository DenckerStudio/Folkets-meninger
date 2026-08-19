import { emptyPollTotals, pollChoicePercent, isPollVotingOpen } from '@/lib/polls/format';
import { pollChoiceLabel, pollTrackLabel } from '@/lib/polls/labels';
import { isNorwayCountyCode } from '@/lib/polls/norway-counties';
import type { PollTotals } from '@/lib/polls/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(emptyPollTotals().total === 0, 'empty totals');
assert(pollChoicePercent({ ja: 2, nei: 2, blank: 0, total: 4 }, 'ja') === 50, 'percent');
assert(
  isPollVotingOpen({
    status: 'open',
    opensAt: null,
    closesAt: new Date(Date.now() + 60_000).toISOString(),
  }),
  'open poll',
);
assert(
  !isPollVotingOpen({
    status: 'closed',
    opensAt: null,
    closesAt: null,
  }),
  'closed poll',
);

const sample: PollTotals = { ja: 1, nei: 0, blank: 0, total: 1 };
assert(pollChoicePercent(sample, 'nei') === 0, 'zero side');
assert(pollChoiceLabel('ja') === 'Ja', 'ja label');
assert(pollChoiceLabel('blank') === 'Blank', 'blank label');
assert(pollTrackLabel('citizen') === 'Borgerinitiativ', 'citizen track');
assert(isNorwayCountyCode('03'), 'oslo code');
assert(!isNorwayCountyCode('99'), 'invalid code');

console.log('polls format tests OK');
