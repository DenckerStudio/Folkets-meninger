import assert from 'node:assert/strict';
import {
  buildMonthGrid,
  filterKalenderEventsByWindow,
  hearingToKalenderEvents,
  type KalenderEvent,
} from './kalender-events';
import type { StortingetHoring } from './stortinget-horinger';

const hearing: StortingetHoring = {
  id: '42',
  horing_status: 'Aktiv',
  komite: { navn: 'Finanskomiteen' },
  horing_sak_info_liste: [{ sak_tittel: 'Statsbudsjettet' }],
  innspillsfrist: '/Date(1893455940000+0200)/',
  horingstidspunkt_liste: [{ tidspunkt: '/Date(1893369540000+0200)/', sted: 'Høringssal 1' }],
};

const events = hearingToKalenderEvents(hearing);
assert.equal(events.length, 2);
assert.equal(events[0].kind, 'session');
assert.equal(events[0].location, 'Høringssal 1');
assert.equal(events[0].href, '/dashboard/horinger/42');
assert.equal(events[1].kind, 'deadline');
assert.equal(events[1].deadlineLabel, 'Innspillsfrist');

const noDates: StortingetHoring = {
  id: '1',
  horingstidspunkt_liste: [{ tidspunkt: '/Date(-62135596800000)/', sted: 'X' }],
};
assert.equal(hearingToKalenderEvents(noDates).length, 0);

const withStartOnly: StortingetHoring = {
  id: '9',
  start_dato: '/Date(1893455940000+0200)/',
  horing_sak_info_liste: [{ sak_tittel: 'Planlagt høring' }],
};
const startEvents = hearingToKalenderEvents(withStartOnly);
assert.equal(startEvents.length, 1);
assert.equal(startEvents[0].kind, 'session');
assert.equal(startEvents[0].id, '9-session-start');

const now = new Date('2026-06-15T12:00:00Z');
const windowEvents: KalenderEvent[] = [
  {
    id: 'old',
    hearingId: '1',
    title: 'Old',
    start: new Date('2025-01-01T12:00:00Z'),
    kind: 'session',
    href: '/dashboard/horinger/1',
    statusKind: 'held',
  },
  {
    id: 'near',
    hearingId: '2',
    title: 'Near',
    start: new Date('2026-06-20T12:00:00Z'),
    kind: 'deadline',
    href: '/dashboard/horinger/2',
    statusKind: 'open',
  },
];
const filtered = filterKalenderEventsByWindow(windowEvents, { pastDays: 90, futureDays: 90, now });
assert.equal(filtered.length, 1);
assert.equal(filtered[0].id, 'near');

const grid = buildMonthGrid(2026, 7);
assert.equal(grid.length, 42);
assert.equal(grid.filter((c) => c.inMonth).length, 31);
assert.equal(grid.find((c) => c.inMonth)?.day, 1);
