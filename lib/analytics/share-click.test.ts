import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildShareLinkExpiredRedirectUrl,
  buildShareLinkHomeRedirectUrl,
  buildSameOriginShareLocation,
} from '@/lib/analytics/share-link-redirect';
import { shouldRecordShareClick } from '@/lib/analytics/share-click';
import { DEFAULT_SITE_URL } from '@/lib/seo/metadata';

const allowed = { ok: true as const, remaining: 1 };
const limited = { ok: false as const, retryAfterSeconds: 30 };

assert.equal(shouldRecordShareClick(allowed, allowed), true);
assert.equal(shouldRecordShareClick(limited, allowed), false);
assert.equal(shouldRecordShareClick(allowed, limited), false);
assert.equal(shouldRecordShareClick(limited, limited), false);

const prevApp = process.env.NEXT_PUBLIC_APP_URL;
const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
delete process.env.NEXT_PUBLIC_APP_URL;
delete process.env.NEXT_PUBLIC_SITE_URL;

try {
  const expired = buildShareLinkExpiredRedirectUrl();
  const home = buildShareLinkHomeRedirectUrl();
  assert.doesNotMatch(expired.href, /localhost/i);
  assert.doesNotMatch(home.href, /localhost/i);
  assert.equal(expired.origin, DEFAULT_SITE_URL);
  assert.equal(expired.search, '?lenke=utlopt');
  assert.notEqual(
    expired.href,
    new URL('/?lenke=utlopt', 'http://localhost:3000/l/ugyldigkode123').toString(),
  );

  const shareTarget = buildSameOriginShareLocation('/dashboard/utforsk', 'abc123');
  assert.ok(shareTarget);
  assert.doesNotMatch(shareTarget!.href, /localhost/i);
  assert.equal(shareTarget!.searchParams.get('fm_share'), 'abc123');
  assert.match(shareTarget!.pathname, /^\/dashboard\/utforsk/);
} finally {
  if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = prevApp;
  if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
}

const route = readFileSync(join(process.cwd(), 'app/l/[code]/route.ts'), 'utf8');
assert.match(route, /checkRateLimit/);
assert.match(route, /share-click:ip:/);
assert.match(route, /share-click:code:/);
assert.match(route, /shouldRecordShareClick/);
assert.match(route, /NextResponse\.redirect/);
assert.doesNotMatch(route, /status:\s*429/);
assert.doesNotMatch(route, /notFound/);
assert.match(route, /if \(!CODE_RE\.test\(code\)\) return redirectExpiredLink\(\)/);
assert.match(
  route,
  /if \(!data \|\| typeof data\.id !== 'string'\) return redirectExpiredLink\(\)/,
);
assert.match(route, /if \(!location\) return redirectExpiredLink\(\)/);
assert.match(route, /buildShareLinkExpiredRedirectUrl/);
assert.match(route, /buildShareLinkHomeRedirectUrl/);
assert.doesNotMatch(route, /request\.url/);
assert.doesNotMatch(route, /NextResponse\.json/);
assert.doesNotMatch(route, /status:\s*503/);
assert.doesNotMatch(route, /status:\s*404/);

console.log('lib/analytics/share-click.test.ts ok');
