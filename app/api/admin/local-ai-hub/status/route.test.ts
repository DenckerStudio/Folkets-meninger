import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(
  join(process.cwd(), 'app/api/admin/local-ai-hub/status/route.ts'),
  'utf8',
);

assert.match(route, /requireAdmin\(\)/);
assert.match(route, /isAdminLocalAiHubEnabled/);
assert.match(route, /loadLocalAiRunnerStatus/);
assert.match(route, /status: 404/);
assert.match(route, /force-dynamic/);
assert.match(route, /no-store/);
assert.doesNotMatch(route, /LOCAL_AI_RUNNER_STATUS_URL/);

console.log('app/api/admin/local-ai-hub/status/route.test.ts: ok');
