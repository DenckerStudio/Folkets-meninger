import assert from 'node:assert/strict';
import { trustedClientIp } from '@/lib/analytics/client-ip';

function req(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/analytics/collect', { headers });
}

assert.equal(trustedClientIp(req({ 'x-real-ip': '203.0.113.5' })), '203.0.113.5');
assert.equal(trustedClientIp(req({ 'x-real-ip': '  203.0.113.5  ' })), '203.0.113.5');
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
assert.equal(
  trustedClientIp(req({ 'x-real-ip': '   ', 'x-forwarded-for': '1.1.1.1, 203.0.113.8' })),
  '203.0.113.8',
);
assert.equal(trustedClientIp(req({ 'x-forwarded-for': ' , ' })), 'unknown');
assert.equal(trustedClientIp(req({})), 'unknown');

console.log('lib/analytics/client-ip.test.ts ok');
