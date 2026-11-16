import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(
  join(process.cwd(), 'app/api/admin/reddit-signals/[signalId]/[action]/route.ts'),
  'utf8',
);

assert.match(route, /requireAdmin\(\)/);
assert.match(route, /isRedditSignalApiAction/);
assert.match(route, /applyRedditSignalAdminAction/);

console.log('app/api/admin/reddit-signals/api-route.test.ts: ok');