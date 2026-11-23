import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildOverviewRefreshRequestInit,
  LOCAL_AI_OVERVIEW_API_PATH,
  LOCAL_AI_OVERVIEW_REFRESH_HEADER,
} from '@/lib/admin/local-ai-hub/overview-client-refresh';

const init = buildOverviewRefreshRequestInit();
assert.equal(init.cache, 'no-store');
assert.equal(
  (init.headers as Record<string, string>)[LOCAL_AI_OVERVIEW_REFRESH_HEADER],
  '1',
);

const clientSource = readFileSync(
  join(process.cwd(), 'app/dashboard/admin/oppgaver/admin-local-ai-hub-client.tsx'),
  'utf8',
);

assert.match(clientSource, new RegExp(`fetch\\('${LOCAL_AI_OVERVIEW_API_PATH.replace(/\//g, '\\/')}'`));
assert.match(clientSource, /buildOverviewRefreshRequestInit/);
assert.doesNotMatch(clientSource, /router\.refresh\(\)/);
assert.doesNotMatch(clientSource, /useRouter/);

const routeSource = readFileSync(
  join(process.cwd(), 'app/api/admin/local-ai-hub/overview/route.ts'),
  'utf8',
);

assert.match(routeSource, /loadLocalAiOverviewCached/);
assert.match(routeSource, /ifNoneMatchAllows304/);
assert.match(routeSource, /ETag/);
assert.match(routeSource, /shouldBypassOverviewCacheFromRequest/);

const overviewSource = readFileSync(
  join(process.cwd(), 'lib/admin/local-ai-hub/overview.ts'),
  'utf8',
);

assert.match(overviewSource, /shouldSkipPullGithubEnrichment/);

console.log('lib/admin/local-ai-hub/overview-client-refresh.test.ts: ok');