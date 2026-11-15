import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  dashboardIndexRedirect,
  isPublicDashboardInnsiktPath,
  isPublicDashboardSporsmalPath,
  routes,
} from '../routes';

assert.equal(dashboardIndexRedirect(routes.dashboard), routes.utforsk);
assert.equal(dashboardIndexRedirect(routes.utforsk), null);
assert.equal(dashboardIndexRedirect(routes.minSide), null);
assert.equal(dashboardIndexRedirect(routes.innsikt), null);
assert.equal(dashboardIndexRedirect(`${routes.dashboard}/`), null);
assert.equal(isPublicDashboardSporsmalPath(routes.sporsmal), true);
assert.equal(isPublicDashboardSporsmalPath(routes.sporsmalDetail('1')), true);

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

assert.equal(isPublicDashboardInnsiktPath(routes.innsikt), true);
assert.equal(isPublicDashboardInnsiktPath(routes.minSide), false);

const middleware = read('middleware.ts');
assert.match(middleware, /isPublicDashboardSporsmalPath/);
const redirectAt = middleware.indexOf('dashboardIndexRedirect(pathname)');
const authAt = middleware.indexOf('resolveMiddlewareUser(request)');
assert.ok(redirectAt >= 0, 'middleware must redirect the dashboard index');
assert.ok(authAt > redirectAt, 'index redirect must run before the auth gate');
assert.match(middleware, /isPublicDashboardInnsiktPath\(pathname\)/);

const kalender = read('app/dashboard/kalender/page.tsx');
assert.doesNotMatch(kalender, /x-forwarded-host|x-forwarded-proto/);
assert.doesNotMatch(kalender, /next\/headers/);
assert.match(kalender, /resolveKalenderSiteOrigin\(\)/);

const explore = read('app/dashboard/utforsk/explore-client.tsx');
assert.doesNotMatch(explore, /ikke representative/);
assert.doesNotMatch(explore, /Åpne for stemmer/);

const header = read('components/ui/header-3.tsx');
assert.match(header, /inDashboard \? null : \(/);
assert.match(header, /Gå til Utforsk/);

console.log('dashboard/dashboard-clarity.test.ts: ok');
