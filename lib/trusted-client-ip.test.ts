import assert from 'node:assert/strict';
import { trustedClientIp } from './trusted-client-ip';

function requestWith(headers: Record<string, string>): Pick<Request, 'headers'> {
  return { headers: new Headers(headers) };
}

assert.equal(
  trustedClientIp(
    requestWith({
      'x-real-ip': ' 203.0.113.5 ',
      'x-forwarded-for': 'spoofed-client, 198.51.100.1',
    }),
  ),
  '203.0.113.5',
);
assert.equal(
  trustedClientIp(
    requestWith({
      'x-forwarded-for': 'spoofed-client, 198.51.100.1, 203.0.113.9',
    }),
  ),
  '203.0.113.9',
);
assert.notEqual(
  trustedClientIp(
    requestWith({
      'x-forwarded-for': 'spoofed-client, 198.51.100.1',
    }),
  ),
  'spoofed-client',
);
assert.equal(
  trustedClientIp(
    requestWith({
      'x-real-ip': '   ',
      'x-forwarded-for': 'spoofed-client, , 198.51.100.1, ',
    }),
  ),
  '198.51.100.1',
);
assert.equal(trustedClientIp(requestWith({})), 'unknown');

console.log('trusted-client-ip.test.ts: ok');
