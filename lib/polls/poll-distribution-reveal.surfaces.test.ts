import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  pollDistributionRevealAllowed,
  redactPollTotalsForViewer,
} from '@/lib/polls/poll-distribution-reveal';

const full: import('@/lib/polls/types').PollTotals = {
  ja: 30,
  nei: 10,
  blank: 5,
  total: 45,
};

const redacted = { ja: 0, nei: 0, blank: 0, total: full.total };

type Combo = {
  votingOpen: boolean;
  hasVoted: boolean;
  label: string;
};

const combos: Combo[] = [
  { votingOpen: true, hasVoted: false, label: 'åpen+ikke stemt' },
  { votingOpen: true, hasVoted: true, label: 'åpen+stemt' },
  { votingOpen: false, hasVoted: false, label: 'avsluttet+ikke stemt' },
  { votingOpen: false, hasVoted: true, label: 'avsluttet+stemt' },
];

for (const { votingOpen, hasVoted, label } of combos) {
  const reveal = pollDistributionRevealAllowed(votingOpen, hasVoted, full);
  const viewer = redactPollTotalsForViewer(full, votingOpen, hasVoted);
  const expectFull = reveal;
  assert.equal(
    reveal,
    (!votingOpen || hasVoted) && full.total >= 5,
    `${label}: reveal matcher (hasVoted || !votingOpen) && k≥5`,
  );
  assert.deepEqual(
    viewer,
    expectFull ? full : redacted,
    `${label}: redactPollTotalsForViewer`,
  );
}

const root = process.cwd();
const surfaceChecks: Array<{ file: string; pattern: RegExp; hint: string }> = [
  {
    file: 'app/api/polls/route.ts',
    pattern: /redactPollTotalsForViewer\(totals,\s*isPollVotingOpen\(poll\),\s*hasVoted\)/,
    hint: 'GET /api/polls',
  },
  {
    file: 'components/polls/poll-ballot.tsx',
    pattern: /redactPollTotalsForViewer\(totals,\s*votingOpen,\s*hasVoted\)/,
    hint: 'PollBallot',
  },
  {
    file: 'components/polls/share-poll-widget.tsx',
    pattern: /redactPollTotalsForViewer\(totals,\s*votingOpen,\s*hasVoted\)/,
    hint: 'del-widget',
  },
  {
    file: 'app/dashboard/avstemninger/page.tsx',
    pattern: /redactPollTotalsForViewer\(totals,\s*votingOpen,\s*hasVoted\)/,
    hint: 'PollCard-liste',
  },
  {
    file: 'app/del/[id]/page.tsx',
    pattern: /redactPollTotalsForViewer\(totals,\s*votingOpen,/,
    hint: '/del SSR',
  },
  {
    file: 'app/embed/[id]/page.tsx',
    pattern: /redactPollTotalsForViewer\(totals,\s*votingOpen,/,
    hint: '/embed SSR',
  },
];

for (const { file, pattern, hint } of surfaceChecks) {
  const src = readFileSync(join(root, file), 'utf8');
  assert.match(src, pattern, `${hint} (${file}) bruker redactPollTotalsForViewer med votingOpen + hasVoted`);
}

const serviceSrc = readFileSync(join(root, 'lib/polls/service.ts'), 'utf8');
assert.match(
  serviceSrc,
  /getUserHasVotedOnPolls failed/,
  'getUserHasVotedOnPolls logger feil',
);

console.log('lib/polls/poll-distribution-reveal.surfaces.test.ts: ok');