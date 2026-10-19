import assert from 'node:assert/strict';
import { checkLoginRateLimit, resetLoginRateLimitForTests } from './loginRateLimit';

resetLoginRateLimitForTests();
for (let i = 0; i < 30; i++) {
  assert.equal(checkLoginRateLimit('203.0.113.1').allowed, true);
}
const blocked = checkLoginRateLimit('203.0.113.1');
assert.equal(blocked.allowed, false);
assert.ok(blocked.retryAfterSec && blocked.retryAfterSec > 0);

resetLoginRateLimitForTests();
assert.equal(checkLoginRateLimit('198.51.100.9').allowed, true);

console.log('cms/src/lib/loginRateLimit.test.ts ok');
