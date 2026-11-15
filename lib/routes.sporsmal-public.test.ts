import assert from 'node:assert/strict';
import { isPublicDashboardSporsmalPath, routes } from './routes';

assert.equal(isPublicDashboardSporsmalPath(routes.sporsmal), true);
assert.equal(isPublicDashboardSporsmalPath(routes.sporsmalDetail('108815')), true);
assert.equal(isPublicDashboardSporsmalPath(routes.utforsk), false);

console.log('lib/routes.sporsmal-public.test.ts: ok');