import assert from 'node:assert/strict';
import {
  countOppfangetStatuses,
  filterOppfangetRows,
  hasActiveOppfangetFilters,
} from '@/lib/admin/oppfanget/filters';

const rows = [
  {
    id: '1',
    title: 'Boikott TV-aksjonen',
    actionType: 'boykott' as const,
    clusterStatus: 'below_threshold' as const,
    pollStatus: null,
    metadata: null,
    sources: [{ publisher: 'nrk.no', signalOnly: false, title: 'NRK' }],
    firstSeenAt: '2026-10-18T10:00:00.000Z',
    lastSeenAt: '2026-10-19T12:00:00.000Z',
  },
  {
    id: '2',
    title: 'Resett signal',
    actionType: 'kampanje' as const,
    clusterStatus: 'candidate' as const,
    pollStatus: null,
    metadata: null,
    sources: [{ publisher: 'resett.no', signalOnly: true, title: 'Notis' }],
    firstSeenAt: '2026-10-19T08:00:00.000Z',
    lastSeenAt: '2026-10-19T09:00:00.000Z',
  },
  {
    id: '3',
    title: 'Støy i feeden',
    actionType: 'kampanje' as const,
    clusterStatus: 'not_action' as const,
    pollStatus: null,
    metadata: null,
    sources: [{ publisher: 'example.com', signalOnly: true, title: 'Notis' }],
    firstSeenAt: '2026-10-19T08:00:00.000Z',
    lastSeenAt: '2026-10-19T09:00:00.000Z',
  },
];

const defaultList = filterOppfangetRows(rows, {});
assert.equal(defaultList.length, 2);
assert.equal(defaultList.some((r) => r.id === '3'), false);

const notActionOnly = filterOppfangetRows(rows, { status: 'not_action' });
assert.equal(notActionOnly.length, 1);
assert.equal(notActionOnly[0]?.id, '3');

const boikottOnly = filterOppfangetRows(rows, { type: 'boikott' });
assert.equal(boikottOnly.length, 1);
assert.equal(boikottOnly[0]?.id, '1');

const meldingOnly = filterOppfangetRows(rows, { type: 'melding' });
assert.equal(meldingOnly.length, 1);
assert.equal(meldingOnly[0]?.id, '2');

const nrkSource = filterOppfangetRows(rows, { source: 'nrk' });
assert.equal(nrkSource.length, 1);

const search = filterOppfangetRows(rows, { q: 'resett' });
assert.equal(search.length, 1);

const counts = countOppfangetStatuses(rows);
assert.equal(counts.under_terskel, 1);
assert.equal(counts.oppfanget, 1);

const oppfangetDisplay = filterOppfangetRows(rows, { status: 'oppfanget' });
assert.equal(oppfangetDisplay.some((r) => r.id === '3'), false);

assert.equal(hasActiveOppfangetFilters({}), false);
assert.equal(hasActiveOppfangetFilters({ q: 'test' }), true);

console.log('admin/oppfanget/filters.test.ts: ok');
