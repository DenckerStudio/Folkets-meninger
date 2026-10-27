import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  POLL_BALLOT_BUTTON_ORDER,
  POLL_VOTE_VALUES,
  pollBallotVoteButtonClassName,
} from '@/lib/polls/ballot-buttons';
import { POLL_BALLOT_CHOICES, pollChoiceLabel } from '@/lib/polls/labels';
import { POLL_BALLOT_CHOICES as SHARE_BALLOT_CHOICES, isPollChoice } from '@/lib/polls/share';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const LABELS: Record<(typeof POLL_VOTE_VALUES)[number], string> = {
  ja: 'Ja',
  nei: 'Nei',
  blank: 'Blank',
};

assert(
  POLL_BALLOT_BUTTON_ORDER.join(',') === 'nei,blank,ja',
  'ballot buttons display as Nei, Blank, Ja',
);
assert(
  POLL_BALLOT_CHOICES.join(',') === POLL_BALLOT_BUTTON_ORDER.join(','),
  'POLL_BALLOT_CHOICES matches button order',
);
assert(
  POLL_BALLOT_CHOICES.join(',') === SHARE_BALLOT_CHOICES.join(','),
  'share helpers re-export the same ballot button order as the dashboard',
);

for (const value of POLL_VOTE_VALUES) {
  assert(isPollChoice(value), `${value} is a valid poll choice for ?valg= links and API`);
  assert(pollChoiceLabel(value) === LABELS[value], `${value} label matches dashboard ballot`);
  assert(POLL_BALLOT_BUTTON_ORDER.includes(value), `${value} appears on the ballot`);
}

assert(POLL_VOTE_VALUES.length === 3, 'three stored vote values');
assert(
  pollBallotVoteButtonClassName('nei').includes('#ba0c2f'),
  'nei uses Reels red',
);
assert(
  pollBallotVoteButtonClassName('ja').includes('#0a3d9e'),
  'ja uses Reels blue',
);
assert(
  pollBallotVoteButtonClassName('blank').includes('bg-white'),
  'blank uses Reels white surface',
);

const shareWidgetSource = readFileSync(
  fileURLToPath(new URL('../../components/polls/share-poll-widget.tsx', import.meta.url)),
  'utf8',
);
const pollBallotSource = readFileSync(
  fileURLToPath(new URL('../../components/polls/poll-ballot.tsx', import.meta.url)),
  'utf8',
);

assert(
  shareWidgetSource.includes('PollBallotVoteButton') &&
    shareWidgetSource.includes('POLL_BALLOT_CHOICES'),
  'share poll widget uses shared ballot vote buttons',
);
assert(
  pollBallotSource.includes('PollBallotVoteButton') &&
    pollBallotSource.includes('POLL_BALLOT_CHOICES'),
  'dashboard poll ballot uses shared ballot vote buttons',
);

console.log('poll ballot consistency tests OK');
