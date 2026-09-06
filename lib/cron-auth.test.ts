import assert from 'node:assert/strict';
import { verifyCronAuth } from './cron-auth-verify';

const originalSecret = process.env.CRON_SECRET;

function makeRequest(secret?: string) {
  const headers = secret ? { 'x-cron-secret': secret } : {};
  return new Request('http://localhost/api/cron/sync-issues', { headers });
}

function withSecret(secret: string | undefined, fn: () => void) {
  if (secret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = secret;
  }
  try {
    fn();
  } finally {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  }
}

withSecret('', () => {
  assert.deepEqual(verifyCronAuth(makeRequest()), {
    ok: false,
    status: 503,
    error: 'CRON_SECRET is not configured',
  });
});

withSecret('test-secret', () => {
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
});

withSecret('  test-secret  ', () => {
  assert.deepEqual(verifyCronAuth(makeRequest('test-secret')), { ok: true });
});

console.log('cron-auth tests passed');
