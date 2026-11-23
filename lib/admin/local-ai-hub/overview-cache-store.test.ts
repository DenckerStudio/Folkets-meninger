import assert from 'node:assert/strict';

import {
  clearOverviewCacheForTests,
  computeOverviewEtag,
  ifNoneMatchAllows304,
  LOCAL_AI_OVERVIEW_CACHE_TTL_MS,
  LOCAL_AI_OVERVIEW_REFRESH_MIN_AGE_MS,
  overviewRefreshBypassAllowed,
  readOverviewCache,
  resolveOverviewBypassRequest,
  writeOverviewCache,
} from '@/lib/admin/local-ai-hub/overview-cache-store';
import type { LocalAiOverviewResult } from '@/lib/admin/local-ai-hub/overview-types';

const okResult: LocalAiOverviewResult = {
  ok: true,
  ferdig: [],
  forslag: [],
  partialErrors: [],
};

clearOverviewCacheForTests();
const serialized = JSON.stringify(okResult);
const etag = computeOverviewEtag(serialized);

assert.match(etag, /^"[a-f0-9]{32}"$/);
assert.equal(computeOverviewEtag(serialized), etag);

const now = 1_700_000_000_000;
writeOverviewCache({
  result: okResult,
  etag,
  expiresAt: now + LOCAL_AI_OVERVIEW_CACHE_TTL_MS,
  cachedAtMs: now,
});
assert.ok(readOverviewCache(now));
assert.equal(readOverviewCache(now + LOCAL_AI_OVERVIEW_CACHE_TTL_MS), null);

assert.equal(overviewRefreshBypassAllowed(now, null), true);
assert.equal(overviewRefreshBypassAllowed(now + 5_000, readOverviewCache(now)), false);
assert.equal(
  overviewRefreshBypassAllowed(now + LOCAL_AI_OVERVIEW_REFRESH_MIN_AGE_MS, readOverviewCache(now)),
  true,
);

const throttled = resolveOverviewBypassRequest(now + 2_000, true);
assert.equal(throttled.effectiveBypass, false);
assert.equal(throttled.servedFromYoungCache, true);
const allowed = resolveOverviewBypassRequest(
  now + LOCAL_AI_OVERVIEW_REFRESH_MIN_AGE_MS,
  true,
);
assert.equal(allowed.effectiveBypass, true);
assert.equal(allowed.servedFromYoungCache, false);

assert.equal(ifNoneMatchAllows304(etag, etag), true);
assert.equal(ifNoneMatchAllows304('W/' + etag, etag), true);
assert.equal(ifNoneMatchAllows304('"no-match"', etag), false);
assert.equal(ifNoneMatchAllows304(null, etag), false);

clearOverviewCacheForTests();
console.log('lib/admin/local-ai-hub/overview-cache-store.test.ts: ok');