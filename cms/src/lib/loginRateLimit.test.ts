import assert from 'node:assert/strict';
import {
  checkLoginRateLimit,
  MAX_ATTEMPTS_PER_IP,
  resetLoginRateLimitForTests,
} from './loginRateLimit';

resetLoginRateLimitForTests();
for (let i = 0; i < MAX_ATTEMPTS_PER_IP; i++) {
  assert.equal(checkLoginRateLimit('203.0.113.1', `user${i}@example.com`).allowed, true);
}
const blockedByIp = checkLoginRateLimit('203.0.113.1', 'another@example.com');
assert.equal(blockedByIp.allowed, false);
assert.ok(blockedByIp.retryAfterSec && blockedByIp.retryAfterSec > 0);

resetLoginRateLimitForTests();
for (let i = 0; i < 30; i++) {
  assert.equal(checkLoginRateLimit('203.0.113.1', 'user@example.com').allowed, true);
}
const blockedByPair = checkLoginRateLimit('203.0.113.1', 'user@example.com');
assert.equal(blockedByPair.allowed, false);

resetLoginRateLimitForTests();
assert.equal(checkLoginRateLimit('198.51.100.9', 'other@example.com').allowed, true);
assert.equal(checkLoginRateLimit('203.0.113.1', 'other@example.com').allowed, true);

console.log('cms/src/lib/loginRateLimit.test.ts ok');
