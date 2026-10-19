import assert from 'node:assert/strict';
import { buildOppfangetAdminPath, buildOppfangetListQueryString } from '@/lib/admin/oppfanget/query';

assert.equal(buildOppfangetListQueryString({}, null), '');
assert.equal(buildOppfangetListQueryString({ q: 'test' }, null), 'q=test');
assert.equal(buildOppfangetListQueryString({}, 'mock'), 'preview=mock');

assert.equal(
  buildOppfangetAdminPath({ q: 'zzz' }, 'mock'),
  '/dashboard/admin/oppfanget?q=zzz&preview=mock',
);
assert.equal(
  buildOppfangetAdminPath({}, 'mock'),
  '/dashboard/admin/oppfanget?preview=mock',
);
assert.equal(buildOppfangetAdminPath({}, null), '/dashboard/admin/oppfanget');

console.log('admin/oppfanget/query.test.ts: ok');
