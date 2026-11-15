import assert from 'node:assert/strict';
import {
  compareHoringerByInnspillDeadline,
  findHoringerForSak,
  formatInnspillFristFromDays,
  formatHoringInnspillFristLabel,
  formatStortingetDate,
  getHoringApplicationDeadline,
  getHoringInnspillDeadline,
  getHoringSkriftligInnspillUrl,
  getHoringStartDate,
  getHoringStatusKind,
  getHoringStatusLabel,
  isHoringInnspillDeadlineWithinDays,
  isHoringOpen,
  parseStortingetDate,
  STORTINGET_MIN_DATE_MS,
} from './stortinget-horinger';

assert.equal(STORTINGET_MIN_DATE_MS, -62_135_596_800_000);

// Negative .NET ticks must not be parsed as positive (3939 bug).
assert.equal(parseStortingetDate('/Date(-62135596800000)/'), null);
assert.equal(formatStortingetDate('/Date(-62135596800000)/'), null);

const validMs = '/Date(1790751600000+0200)/';
const validDate = parseStortingetDate(validMs);
assert.ok(validDate);
assert.equal(validDate?.getFullYear(), 2026);

const hearing10005766 = {
  id: '10005766',
  horing_status: 'Planlagt',
  innspillsfrist: '/Date(-62135596800000)/',
  soknadfrist_dato: '/Date(-62135596800000)/',
  anmodningsfrist_dato_tid: '/Date(-62135596800000)/',
  start_dato: validMs,
  skriftlig: false,
  horingstidspunkt_liste: [{ sted: 'Høringssal 1', tidspunkt: validMs }],
};

assert.equal(getHoringInnspillDeadline(hearing10005766), null);
assert.equal(getHoringApplicationDeadline(hearing10005766), null);
assert.ok(getHoringStartDate(hearing10005766));
assert.equal(getHoringStatusKind(hearing10005766), 'planned');
assert.equal(isHoringOpen(hearing10005766), false);
assert.equal(getHoringStatusLabel(hearing10005766), 'Planlagt');

const aktivOpen = {
  id: '1',
  horing_status: 'Aktiv',
  innspillsfrist: '/Date(1893455940000+0200)/',
};
assert.equal(getHoringStatusKind(aktivOpen), 'open');
assert.equal(isHoringOpen(aktivOpen), true);

const linked = findHoringerForSak(
  [
    { id: 'h1', horing_sak_info_liste: [{ sak_id: 200211 }] },
    { id: 'h2', horing_sak_info_liste: [{ sak_id: 1 }] },
  ],
  '200211',
);
assert.deepEqual(linked.map((h) => h.id), ['h1']);

assert.equal(
  getHoringSkriftligInnspillUrl({ id: '10005906' }),
  'https://www.stortinget.no/no/Hva-skjer-pa-Stortinget/Horing/skriv-skriftlig-innspill/?h=10005906',
);

const futureA = '/Date(1924996740000+0200)/';
const futureB = '/Date(1927588740000+0200)/';

const openSoon = {
  id: 'open-soon',
  horing_status: 'Aktiv',
  innspillsfrist: futureA,
};

const openLater = {
  id: 'open-later',
  horing_status: 'Aktiv',
  innspillsfrist: futureB,
};

const label = formatHoringInnspillFristLabel(openSoon);
assert.ok(
  label === 'Frist i dag' ||
    (label?.startsWith('Frist om ') ?? false) ||
    label === 'Fristen har gått ut',
);

assert.ok(compareHoringerByInnspillDeadline(openSoon, openLater) < 0);

const expiredOpen = {
  id: 'expired',
  horing_status: 'Aktiv',
  innspillsfrist: '/Date(1609459200000+0100)/',
};

const noDeadlineOpen = {
  id: 'no-deadline',
  horing_status: 'Aktiv',
};

assert.ok(compareHoringerByInnspillDeadline(openSoon, expiredOpen) < 0);
assert.ok(compareHoringerByInnspillDeadline(noDeadlineOpen, expiredOpen) < 0);

const sortedByFrist = [expiredOpen, noDeadlineOpen, openSoon, openLater].sort(
  compareHoringerByInnspillDeadline,
);
assert.deepEqual(
  sortedByFrist.map((h) => h.id),
  ['open-soon', 'open-later', 'no-deadline', 'expired'],
);

assert.equal(formatInnspillFristFromDays(0), 'Frist i dag');
assert.equal(formatInnspillFristFromDays(1), 'Frist i morgen');
assert.equal(formatInnspillFristFromDays(2), 'Frist om 2 dager');
assert.equal(formatInnspillFristFromDays(-1), 'Fristen har gått ut');

assert.equal(isHoringInnspillDeadlineWithinDays(openSoon, 2000), true);
assert.equal(isHoringInnspillDeadlineWithinDays(openSoon, 7), false);
assert.equal(isHoringInnspillDeadlineWithinDays(hearing10005766, 7), false);

console.log('stortinget-horinger.test.ts: ok');
