import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { redactPollFylkeTotalsForViewer } from '@/lib/polls/poll-distribution-reveal';
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

const openHidden = redactPollFylkeTotalsForViewer([row], true, false);
assert.equal(openHidden[0]?.ja, null, 'åpen ikke stemt: skjul ja');
assert.equal(openHidden[0]?.sufficientData, false);
assert.equal(openHidden[0]?.total, 32, 'behold total');

const openVoted = redactPollFylkeTotalsForViewer([row], true, true);
assert.equal(openVoted[0]?.ja, 20, 'åpen stemt: vis ved k≥5');

const closed = redactPollFylkeTotalsForViewer([row], false, false);
assert.equal(closed[0]?.ja, 20, 'avsluttet: vis for alle');

const lowRow: PollFylkeTotals = { ...row, ja: 1, nei: 1, blank: 0, total: 2, sufficientData: true };
const closedLow = redactPollFylkeTotalsForViewer([lowRow], false, false);
assert.equal(closedLow[0]?.sufficientData, false, 'under k per fylke skjules');

const apiSrc = readFileSync(join(process.cwd(), 'app/api/polls/route.ts'), 'utf8');
const pageSrc = readFileSync(
  join(process.cwd(), 'app/dashboard/avstemninger/[id]/page.tsx'),
  'utf8',
);
assert.match(apiSrc, /redactPollFylkeTotalsForViewer\(byFylke/);
assert.match(pageSrc, /redactPollFylkeTotalsForViewer\(byFylke/);
assert.match(pageSrc, /PollResultView byFylke=\{viewerByFylke\}/);

console.log('lib/polls/poll-fylke-reveal.test.ts: ok');