import assert from 'node:assert/strict';

import {
  clearOverviewCacheForTests,
  computeOverviewEtag,
  ifNoneMatchAllows304,
  LOCAL_AI_OVERVIEW_CACHE_TTL_MS,
  readOverviewCache,
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
writeOverviewCache({ result: okResult, etag, expiresAt: now + LOCAL_AI_OVERVIEW_CACHE_TTL_MS });
assert.ok(readOverviewCache(now));
assert.equal(readOverviewCache(now + LOCAL_AI_OVERVIEW_CACHE_TTL_MS), null);

assert.equal(ifNoneMatchAllows304(etag, etag), true);
assert.equal(ifNoneMatchAllows304('W/' + etag, etag), true);
assert.equal(ifNoneMatchAllows304('"no-match"', etag), false);
assert.equal(ifNoneMatchAllows304(null, etag), false);

clearOverviewCacheForTests();
console.log('lib/admin/local-ai-hub/overview-cache-store.test.ts: ok');