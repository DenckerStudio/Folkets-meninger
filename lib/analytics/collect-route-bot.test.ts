import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(
  join(process.cwd(), 'app/api/analytics/collect/route.ts'),
  'utf-8',
);

assert.match(route, /isLikelyBot/);
assert.match(route, /if \(isLikelyBot\(userAgent\)\)/);
assert.match(route, /status: 204/);
assert.match(route, /eventName === 'http_error'/);

console.log('lib/analytics/collect-route-bot.test.ts: ok');
