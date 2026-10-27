import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes: Array<{ path: string; keys: string[] }> = [
  {
    path: 'app/api/user/profile/route.ts',
    keys: ['user-profile:ip:', 'user-profile:user:'],
  },
  {
    path: 'app/api/user/political-consent/route.ts',
    keys: ['political-consent:ip:', 'political-consent:user:'],
  },
  {
    path: 'app/api/auth/welcome-email/route.ts',
    keys: ['welcome-email:ip:', 'welcome-email:user:'],
  },
  {
    path: 'app/api/politician/response/route.ts',
    keys: ['politician-response:ip:', 'politician-response:user:'],
  },
];

for (const { path, keys } of routes) {
  const src = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.match(src, /checkRateLimit/, `${path} must call checkRateLimit`);
  assert.match(src, /status: 429/, `${path} must return 429 when limited`);
  assert.match(src, /Retry-After/, `${path} must set Retry-After header`);
  for (const key of keys) {
    assert.match(src, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${path} missing key ${key}`);
  }
}

console.log('lib/rate-limit-audit-routes.test.ts: ok');
