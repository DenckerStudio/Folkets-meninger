import assert from 'node:assert/strict';
import { isLikelyBot } from '@/lib/analytics/bot';

assert.equal(isLikelyBot(null), true);
assert.equal(isLikelyBot(''), true);
assert.equal(isLikelyBot('   '), true);

assert.equal(
  isLikelyBot(
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ),
  true,
);
assert.equal(isLikelyBot('curl/8.5.0'), true);
assert.equal(isLikelyBot('python-requests/2.31.0'), true);
assert.equal(isLikelyBot('facebookexternalhit/1.1'), true);
assert.equal(isLikelyBot('GPTBot/1.0'), true);

assert.equal(
  isLikelyBot(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  ),
  false,
);
assert.equal(
  isLikelyBot(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ),
  false,
);

console.log('lib/analytics/bot.test.ts ok');
