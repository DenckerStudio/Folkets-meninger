import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const topicRoute = readFileSync(
  new URL('../../app/api/admin/research/topics/[topicId]/more-sources/route.ts', import.meta.url),
  'utf8',
);

assert.match(topicRoute, /parsePublicSearchRequestBody/);
assert.match(topicRoute, /checkRateLimit/);
assert.match(topicRoute, /status: 429/);
assert.match(topicRoute, /Retry-After/);
assert.doesNotMatch(topicRoute, /searchParams\.get\(['"]q['"]\)/);
assert.doesNotMatch(topicRoute, /\.body\.q/);

const issueRoute = readFileSync(
  new URL('../../app/api/admin/research/issues/[issueId]/more-sources/route.ts', import.meta.url),
  'utf8',
);
assert.match(issueRoute, /parsePublicSearchRequestBody/);

console.log('lib/sources/more-sources-route-boundary.test.ts: ok');