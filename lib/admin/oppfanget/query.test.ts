import assert from 'node:assert/strict';
import {
  buildOppfangetAdminPath,
  buildOppfangetListQueryString,
  parseOppfangetFilters,
} from '@/lib/admin/oppfanget/query';

assert.equal(buildOppfangetListQueryString({}, null), '');
assert.equal(buildOppfangetListQueryString({ q: 'test' }, null), 'q=test');
assert.equal(buildOppfangetListQueryString({}, 'mock'), 'preview=mock');

assert.equal(
  buildOppfangetAdminPath({ q: 'zzz' }, 'mock'),
  '/dashboard/admin/research?q=zzz&preview=mock',
);
assert.equal(
  buildOppfangetAdminPath({}, 'mock'),
  '/dashboard/admin/research?preview=mock',
);
assert.equal(buildOppfangetAdminPath({}, null), '/dashboard/admin/research');

assert.deepEqual(
  parseOppfangetFilters({
    type: 'melding',
    status: 'oppfanget',
    source: 'nrk.no',
    dateFrom: '2026-01-01',
    dateTo: '2026-12-31',
    q: 'demonstrasjon',
  }),
  {
    type: 'melding',
    status: 'oppfanget',
    source: 'nrk.no',
    dateFrom: '2026-01-01',
    dateTo: '2026-12-31',
    q: 'demonstrasjon',
  },
);

assert.deepEqual(parseOppfangetFilters({ status: 'not_action' }).status, 'not_action');

assert.deepEqual(parseOppfangetFilters({ type: 'not-a-type', status: 'bogus' }), {
  type: '',
  status: '',
  source: '',
  dateFrom: '',
  dateTo: '',
  q: '',
});

assert.deepEqual(parseOppfangetFilters({ type: ['melding'] }), {
  type: '',
  status: '',
  source: '',
  dateFrom: '',
  dateTo: '',
  q: '',
});

assert.equal(
  buildOppfangetListQueryString({
    type: 'aksjon',
    status: 'under_terskel',
    source: '  vg.no  ',
    q: '  søk  ',
  }),
  'type=aksjon&status=under_terskel&source=vg.no&q=s%C3%B8k',
);

console.log('admin/oppfanget/query.test.ts: ok');
