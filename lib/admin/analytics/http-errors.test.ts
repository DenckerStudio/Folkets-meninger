import assert from 'node:assert/strict';
import {
  httpErrorsNotReady,
  mapAdminHttpErrors,
} from '@/lib/admin/analytics/http-errors';

const mapped = mapAdminHttpErrors({
  ready: true,
  days: 7,
  source: 'traefik',
  errorRowCountHuman: 40,
  errorRowCountBot: 100,
  top404: [
    { path_template: '/missing', host: 'www.folkets-meninger.no', request_count: 12 },
  ],
  statusClasses: [{ status_class: '4xx', request_count: 30 }],
  fiveXxByDay: [{ bucket_date: '2026-11-21', request_count: 2 }],
});

assert.equal(mapped.ready, true);
assert.equal(mapped.days, 7);
assert.equal(mapped.top404[0]?.pathTemplate, '/missing');
assert.equal(mapped.top404[0]?.requestCount, 12);
assert.equal(mapped.statusClasses[0]?.statusClass, '4xx');
assert.equal(mapped.fiveXxByDay[0]?.bucketDate, '2026-11-21');
assert.equal(httpErrorsNotReady.ready, false);

console.log('admin/analytics/http-errors.test.ts: ok');
