import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  POLL_FYLKE_HIDDEN_UNTIL_VOTE_MESSAGE,
  preparePollFylkeForViewer,
} from '@/lib/polls/poll-distribution-reveal';
import type { PollFylkeTotals } from '@/lib/polls/types';

const row: PollFylkeTotals = {
  code: '03',
  name: 'Oslo',
  ja: 20,
  nei: 10,
  blank: 2,
  total: 32,
  sufficientData: true,
};

const openNotVoted = preparePollFylkeForViewer([row], true, false);
assert.equal(openNotVoted.hiddenUntilVote, true, 'flagg når åpen ikke stemt');
assert.deepEqual(openNotVoted.byFylke, [], 'ingen rader på server til ikke-stemmer');

const openVoted = preparePollFylkeForViewer([row], true, true);
assert.equal(openVoted.hiddenUntilVote, false);
assert.equal(openVoted.byFylke[0]?.ja, 20);

const closed = preparePollFylkeForViewer([row], false, false);
assert.equal(closed.hiddenUntilVote, false);
assert.equal(closed.byFylke[0]?.ja, 20);

const lowRow: PollFylkeTotals = { ...row, ja: 1, nei: 1, blank: 0, total: 2, sufficientData: true };
const closedLow = preparePollFylkeForViewer([lowRow], false, false);
assert.equal(closedLow.byFylke[0]?.sufficientData, false, 'for få stemmer, ikke hiddenUntilVote');
assert.equal(closedLow.byFylke[0]?.hiddenUntilVote, false);

const pollResultSrc = readFileSync(
  join(process.cwd(), 'components/polls/poll-result-view.tsx'),
  'utf8',
);
assert.match(pollResultSrc, /hiddenUntilVote/);
assert.match(pollResultSrc, /POLL_FYLKE_HIDDEN_UNTIL_VOTE_MESSAGE/);

const apiSrc = readFileSync(join(process.cwd(), 'app/api/polls/route.ts'), 'utf8');
const pageSrc = readFileSync(
  join(process.cwd(), 'app/dashboard/avstemninger/[id]/page.tsx'),
  'utf8',
);
assert.match(apiSrc, /preparePollFylkeForViewer/);
assert.match(apiSrc, /fylkeHiddenUntilVote/);
assert.match(pageSrc, /hiddenUntilVote=\{fylkeForViewer\.hiddenUntilVote\}/);

console.log('lib/polls/poll-fylke-reveal.test.ts: ok');