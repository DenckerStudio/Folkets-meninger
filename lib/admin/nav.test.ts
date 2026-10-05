import assert from 'node:assert/strict';
import { adminNavIsActive, adminNavItems } from '@/lib/admin/nav';
import { routes } from '@/lib/routes';

const forslag = adminNavItems.find((item) => item.id === 'appens-fremtid');
assert.ok(forslag);
assert.equal(forslag.title, 'Appens fremtid');
assert.equal(forslag.status, 'active');
assert.equal(forslag.href, routes.adminForslag);

const brukere = adminNavItems.find((item) => item.id === 'brukere');
assert.ok(brukere);
assert.equal(brukere.status, 'active');
assert.equal(brukere.href, routes.adminBrukere);

const stemmePlus = adminNavItems.find((item) => item.id === 'stemme-plus');
assert.ok(stemmePlus);
assert.equal(stemmePlus.status, 'active');
assert.equal(stemmePlus.href, routes.adminStemmePlus);

const varsler = adminNavItems.find((item) => item.id === 'varsler');
assert.ok(varsler);
assert.equal(varsler.status, 'coming');
assert.equal(varsler.href, undefined);

assert.equal(adminNavIsActive(routes.adminForslag, routes.adminForslag), true);
assert.equal(adminNavIsActive(routes.adminReels, routes.adminForslag), false);

console.log('admin/nav.test.ts: ok');
