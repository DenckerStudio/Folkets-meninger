import assert from 'node:assert/strict';
import type { PollRecord } from '@/lib/polls/types';
import { MIN_PUBLIC_AGGREGATE_N } from '@/lib/public-aggregate/constants';
import { computeLandingOpenPollsSnapshot } from '@/lib/landing/home-data';
import {
  formatLandingPollDeadline,
  LANDING_DISPLAY_TIMEZONE,
} from '@/lib/landing/display-time';

const basePoll = (overrides: Partial<PollRecord> = {}): PollRecord => ({
  id: 'poll-1',
  track: 'stortinget',
  status: 'open',
  title: 'Test',
  neutralSummary: '',
  sourceUrls: [],
  stortingetIssueId: '1',
  citizenInitiativeId: null,
  opensAt: null,
  closesAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  expiredAt: null,
  restoredAt: null,
  generationMetadata: {},
  ...overrides,
});

assert.equal(
  computeLandingOpenPollsSnapshot([], {}).openCount,
  0,
  'empty open polls → count 0',
);

const now = new Date('2026-06-15T12:00:00.000Z').getTime();
const pollA = basePoll({ id: 'a', closesAt: '2026-06-20T18:00:00.000Z' });
const pollB = basePoll({ id: 'b', closesAt: '2026-06-18T10:00:00.000Z' });
const snapshot = computeLandingOpenPollsSnapshot([pollA, pollB], { a: 3, b: 2 }, now);
assert.equal(snapshot.openCount, 2);
assert.equal(snapshot.nearestClosesAt, pollB.closesAt);
assert.ok(snapshot.nearestDeadlineLabel?.includes('18'), 'nærmeste frist formatteres');

const belowThreshold = computeLandingOpenPollsSnapshot(
  [basePoll({ id: 'x' })],
  { x: MIN_PUBLIC_AGGREGATE_N - 1 },
  now,
);
assert.equal(belowThreshold.publicVoteCount, null, 'under k-grense → ingen offentlig stemmetall');

const atThreshold = computeLandingOpenPollsSnapshot(
  [basePoll({ id: 'y' })],
  { y: MIN_PUBLIC_AGGREGATE_N },
  now,
);
assert.equal(atThreshold.publicVoteCount, MIN_PUBLIC_AGGREGATE_N);

const deadline = formatLandingPollDeadline('2026-12-24T15:30:00.000Z', now);
assert.ok(deadline, 'gyldig frist gir tekst');

const utcSummer = '2026-06-18T08:00:00.000Z';
const osloLabel = formatLandingPollDeadline(utcSummer, new Date('2026-06-01T00:00:00.000Z').getTime());
const utcLabel = new Date(utcSummer).toLocaleString('nb-NO', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});
assert.notEqual(osloLabel, utcLabel, 'Oslo skal ikke matche UTC-visning');
assert.match(osloLabel ?? '', /10:00/, 'sommertid Europe/Oslo (+2) fra UTC');
assert.equal(LANDING_DISPLAY_TIMEZONE, 'Europe/Oslo');

console.log('lib/landing/home-data.test.ts: ok');