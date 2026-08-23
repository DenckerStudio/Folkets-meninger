import assert from 'node:assert/strict';
import { buildHoringerIcs, escapeIcsText, formatIcsUtc } from './kalender-ics';
import type { KalenderEvent } from './kalender-events';

assert.equal(escapeIcsText('A;B,C\nD'), 'A\\;B\\,C\\nD');
assert.equal(formatIcsUtc(new Date('2026-08-21T09:30:00Z')), '20260821T093000Z');

const event: KalenderEvent = {
  id: '42-session-0',
  hearingId: '42',
  title: 'Statsbudsjettet',
  start: new Date('2026-09-01T08:00:00Z'),
  location: 'Høringssal 1',
  kind: 'session',
  komite: 'Finanskomiteen',
  href: '/dashboard/horinger/42',
  statusKind: 'open',
};

const ics = buildHoringerIcs([event], 'https://folketsstemme.no');
assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
assert.ok(ics.includes('END:VCALENDAR'));
assert.ok(ics.includes('SUMMARY:Statsbudsjettet'));
assert.ok(ics.includes('URL:https://folketsstemme.no/dashboard/horinger/42'));
assert.ok(ics.includes('LOCATION:Høringssal 1'));
assert.ok(ics.includes('UID:42-session-0@folketsmeninger'));
