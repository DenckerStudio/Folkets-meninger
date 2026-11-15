import assert from 'node:assert/strict';
import { checkRateLimitMemory } from '@/lib/rate-limit-memory';
import { getRateLimitPolicy } from '@/lib/rate-limit';
import {
  normalizeUtforskIssueSearchQuery,
  utforskIssueSearchRateLimitKey,
  UTFORSK_ISSUE_SEARCH_IP_LIMIT,
  UTFORSK_ISSUE_SEARCH_IP_WINDOW_MS,
  UTFORSK_ISSUE_SEARCH_MAX_QUERY_CHARS,
} from './utforsk-issue-search-api';

assert.equal(normalizeUtforskIssueSearchQuery('').shouldSearch, false);
assert.equal(normalizeUtforskIssueSearchQuery('  ').shouldSearch, false);
assert.equal(normalizeUtforskIssueSearchQuery('a').shouldSearch, false);
assert.equal(normalizeUtforskIssueSearchQuery(' ab ').shouldSearch, true);
assert.equal(normalizeUtforskIssueSearchQuery('ab').query, 'ab');

const long = 'x'.repeat(UTFORSK_ISSUE_SEARCH_MAX_QUERY_CHARS + 10);
assert.equal(
  normalizeUtforskIssueSearchQuery(long).query.length,
  UTFORSK_ISSUE_SEARCH_MAX_QUERY_CHARS,
);

const rateKey = utforskIssueSearchRateLimitKey('203.0.113.9');
for (let i = 0; i < UTFORSK_ISSUE_SEARCH_IP_LIMIT; i++) {
  const allowed = checkRateLimitMemory(rateKey, UTFORSK_ISSUE_SEARCH_IP_LIMIT, UTFORSK_ISSUE_SEARCH_IP_WINDOW_MS);
  assert.equal(allowed.ok, true, `request ${i + 1} should be allowed`);
}
const denied = checkRateLimitMemory(rateKey, UTFORSK_ISSUE_SEARCH_IP_LIMIT, UTFORSK_ISSUE_SEARCH_IP_WINDOW_MS);
assert.equal(denied.ok, false);
if (!denied.ok) {
  assert.ok(denied.retryAfterSeconds >= 1);
}

const policy = getRateLimitPolicy('/api/dashboard/utforsk/issue-search', 'GET');
assert.ok(policy);
assert.equal(policy!.limit, UTFORSK_ISSUE_SEARCH_IP_LIMIT);
assert.equal(policy!.windowMs, UTFORSK_ISSUE_SEARCH_IP_WINDOW_MS);

console.log('lib/search/utforsk-issue-search-api.test.ts: ok');