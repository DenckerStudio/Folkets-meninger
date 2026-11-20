import assert from 'node:assert/strict';
import {
  formatSakDate,
  formatSakDateFromRaw,
  parseSakDate,
  rewriteDottedDatesForDisplay,
} from './date-format';

assert.equal(formatSakDateFromRaw('09.04.2026'), '9. april 2026');
assert.equal(formatSakDateFromRaw('26.03.2026 00:00:00'), '26. mars 2026');
assert.equal(formatSakDateFromRaw('1.2.2026'), '1. februar 2026');
assert.equal(formatSakDateFromRaw('/Date(1781827200000+0200)/'), '19. juni 2026');
assert.equal(formatSakDateFromRaw('2026-06-11'), '11. juni 2026');
assert.equal(formatSakDateFromRaw('2026-06-11T08:00:00Z'), '11. juni 2026');
assert.equal(
  formatSakDateFromRaw('2026-06-11T23:30:00Z'),
  '12. juni 2026',
  'ISO-tidspunkt tolkes i Europe/Oslo',
);
assert.equal(formatSakDate(new Date(Date.UTC(2026, 3, 9, 12))), '9. april 2026');
assert.equal(formatSakDateFromRaw(new Date(Date.UTC(2026, 11, 1, 12))), '1. desember 2026');

assert.equal(formatSakDateFromRaw('01.01.0001 00:00:00'), null);
assert.equal(formatSakDateFromRaw('01.01.0001'), null);
assert.equal(formatSakDateFromRaw('/Date(-62135596800000+0100)/'), null);
assert.equal(formatSakDateFromRaw('ikke en dato'), null);
assert.equal(formatSakDateFromRaw('31.02.2026'), null, 'ugyldig kalenderdag');
assert.equal(formatSakDateFromRaw('09.13.2026'), null, 'ugyldig måned');
assert.equal(formatSakDateFromRaw(''), null);
assert.equal(formatSakDateFromRaw(null), null);
assert.equal(formatSakDateFromRaw(undefined), null);
assert.equal(formatSakDateFromRaw(new Date('x')), null);
assert.equal(parseSakDate('2026-06-11')?.toISOString(), '2026-06-11T12:00:00.000Z');

assert.equal(rewriteDottedDatesForDisplay('Stortingsreferat 09.04.2026'), 'Stortingsreferat 9. april 2026');
assert.equal(rewriteDottedDatesForDisplay('Stortingsreferat 19.06.2026'), 'Stortingsreferat 19. juni 2026');
assert.equal(
  rewriteDottedDatesForDisplay('Møte 09.04.2026 og 12.06.2026.'),
  'Møte 9. april 2026 og 12. juni 2026.',
);
assert.equal(
  rewriteDottedDatesForDisplay('Innst. 458 S (2025-2026)'),
  'Innst. 458 S (2025-2026)',
  'dokumentnummer er ikke datoer',
);
assert.equal(rewriteDottedDatesForDisplay('Dokument 8:256 S (2025-2026)'), 'Dokument 8:256 S (2025-2026)');
assert.equal(rewriteDottedDatesForDisplay('Versjon 1.2.3.4567'), 'Versjon 1.2.3.4567');
assert.equal(rewriteDottedDatesForDisplay('Referat 31.02.2026'), 'Referat 31.02.2026', 'ugyldig dato står urørt');
assert.equal(rewriteDottedDatesForDisplay('Referat 01.01.0001'), 'Referat 01.01.0001');
assert.equal(rewriteDottedDatesForDisplay(''), '');

console.log('lib/sak/date-format.test.ts: ok');
