import assert from 'node:assert/strict';
import { trustedClientIp } from './trustedClientIp';

function req(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/users/login', { headers });
}

assert.equal(trustedClientIp(req({ 'x-real-ip': '203.0.113.5' })), '203.0.113.5');
assert.equal(
  trustedClientIp(req({ 'x-forwarded-for': '198.51.100.1, 203.0.113.9' })),
  '203.0.113.9',
);
assert.equal(
  trustedClientIp(
    req({
      'x-forwarded-for': 'spoofed-client, 198.51.100.1',
      'x-real-ip': '203.0.113.2',
    }),
  ),
  '203.0.113.2',
);

console.log('cms/src/lib/trustedClientIp.test.ts ok');
