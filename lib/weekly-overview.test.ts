import assert from 'node:assert/strict';
import {
  buildWeeklyOverviewWindow,
  countSkriftligeSporsmalInWindow,
  daysUntilOsloCalendarDeadline,
  filterHearingsWithInnspillFristWithinDays,
  filterRecentlyVotedIssues,
  filterSummariesUpdatedInWindow,
  filterVotingSoonIssues,
} from './weekly-overview';
import type { StortingetHoring } from './stortinget-horinger';
import { parseStortingetDate } from './stortinget-horinger';

const fixedNow = new Date('2026-11-15T12:00:00.000Z');
const window = buildWeeklyOverviewWindow(fixedNow);

assert.ok(window.pastStart.getTime() < fixedNow.getTime());
assert.ok(window.futureEnd.getTime() > fixedNow.getTime());
assert.ok(window.label.includes('2026'));

const nearDeadline = parseStortingetDate('/Date(1893455940000+0200)/');
assert.ok(nearDeadline);
const days = daysUntilOsloCalendarDeadline(nearDeadline, fixedNow);
assert.ok(typeof days === 'number');

function dotnetDate(d: Date): string {
  return `/Date(${d.getTime()}+0000)/`;
}

const hearingInWindow: StortingetHoring = {
  id: 'in-window',
  horing_status: 'Aktiv',
  innspillsfrist: dotnetDate(new Date(fixedNow.getTime() + 3 * 86_400_000)),
};

const hearingOutside: StortingetHoring = {
  id: 'outside',
  horing_status: 'Aktiv',
  innspillsfrist: dotnetDate(new Date(fixedNow.getTime() + 20 * 86_400_000)),
};

const hearingFiltered = filterHearingsWithInnspillFristWithinDays(
  [hearingOutside, hearingInWindow],
  7,
  fixedNow,
);

assert.deepEqual(
  hearingFiltered.map((h) => h.id),
  ['in-window'],
);

const votingRows = [
  {
    id: '1',
    title: 'Tidlig',
    voting_closes_at: '2026-11-18T00:00:00.000Z',
    ferdigbehandlet: false,
  },
  {
    id: '2',
    title: 'Sen',
    voting_closes_at: '2026-11-25T00:00:00.000Z',
    ferdigbehandlet: false,
  },
  {
    id: '3',
    title: 'Ferdig',
    voting_closes_at: '2026-11-10T00:00:00.000Z',
    ferdigbehandlet: true,
  },
];

const soon = filterVotingSoonIssues(votingRows, window);
assert.deepEqual(
  soon.map((row) => row.id),
  ['1'],
);

const recent = filterRecentlyVotedIssues(votingRows, window);
assert.deepEqual(
  recent.map((row) => row.id),
  ['3'],
);

const summaries = filterSummariesUpdatedInWindow(
  [
    { issueId: 'a', title: 'A', updatedAt: '2026-11-09T00:00:00.000Z' },
    { issueId: 'b', title: 'B', updatedAt: '2026-11-12T00:00:00.000Z' },
    { issueId: 'c', title: 'C', updatedAt: '2026-11-20T00:00:00.000Z' },
  ],
  window,
);

assert.deepEqual(
  summaries.map((row) => row.issueId),
  ['b', 'a'],
);

const sporsmalCount = countSkriftligeSporsmalInWindow(
  [
    { sendt_dato: dotnetDate(new Date(fixedNow.getTime() - 2 * 86_400_000)) },
    { sendt_dato: dotnetDate(new Date(fixedNow.getTime() - 30 * 86_400_000)) },
  ],
  window,
);

assert.equal(sporsmalCount, 1);

const emptySoon = filterVotingSoonIssues([], window);
assert.deepEqual(emptySoon, []);

console.log('lib/weekly-overview.test.ts: ok');