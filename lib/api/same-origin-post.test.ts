import assert from 'node:assert/strict';
import { isSameOriginPost } from './same-origin-post';

function req(headers: Record<string, string>): Request {
  return new Request('https://www.folkets-meninger.no/api/user/delete-account', {
    method: 'POST',
    headers,
  });
}

assert.equal(
  isSameOriginPost(req({ 'sec-fetch-site': 'same-origin' })),
  true,
  'same-origin Sec-Fetch-Site',
);
assert.equal(
  isSameOriginPost(req({ 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' })),
  false,
  'cross-site',
);
assert.equal(
  isSameOriginPost(
    req({
      origin: 'https://www.folkets-meninger.no',
      host: 'www.folkets-meninger.no',
      'x-forwarded-proto': 'https',
    }),
  ),
  true,
  'matching Origin',
);
assert.equal(
  isSameOriginPost(
    req({
      origin: 'https://evil.example',
      host: 'www.folkets-meninger.no',
      'x-forwarded-proto': 'https',
    }),
  ),
  false,
  'mismatched Origin',
);

console.log('lib/api/same-origin-post.test.ts: ok');