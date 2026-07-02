import assert from 'node:assert/strict';
import {
  formatStortingetDate,
  getHoringApplicationDeadline,
  getHoringInnspillDeadline,
  getHoringStartDate,
  getHoringStatusKind,
  getHoringStatusLabel,
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

console.log('stortinget-horinger.test.ts: ok');
