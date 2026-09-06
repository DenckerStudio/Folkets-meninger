import assert from 'node:assert/strict';
import { verifyCronAuth } from './cron-auth';

function makeRequest(secret?: string) {
  const headers = secret ? { 'x-cron-secret': secret } : {};
  return new Request('http://localhost/api/cron/sync-issues', { headers });
}

const originalSecret = process.env.CRON_SECRET;

process.env.CRON_SECRET = '';
assert.deepEqual(verifyCronAuth(makeRequest()), {
  ok: false,
  status: 503,
  error: 'CRON_SECRET is not configured',
});

process.env.CRON_SECRET = 'test-secret';
assert.deepEqual(verifyCronAuth(makeRequest()), {
  ok: false,
  status: 401,
  error: 'Unauthorized',
});
assert.deepEqual(verifyCronAuth(makeRequest('wrong-secret')), {
  ok: false,
  status: 401,
  error: 'Unauthorized',
});
assert.deepEqual(verifyCronAuth(makeRequest('test-secret')), { ok: true });
assert.deepEqual(verifyCronAuth(makeRequest('  test-secret  ')), { ok: true });

process.env.CRON_SECRET = '  test-secret  ';
assert.deepEqual(verifyCronAuth(makeRequest('test-secret')), { ok: true });

process.env.CRON_SECRET = originalSecret;

console.log('cron-auth tests passed');
