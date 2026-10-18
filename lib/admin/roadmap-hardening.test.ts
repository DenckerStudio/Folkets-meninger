import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261020110000_roadmap_write_hardening.sql'),
  'utf-8',
);

assert.match(migration, /update_app_roadmap_item/);
assert.match(migration, /app_future_require_admin\(p_admin_user_id\)/);
assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.app_roadmap_items/);

const appFuture = readFileSync(join(process.cwd(), 'lib/admin/app-future.ts'), 'utf-8');
assert.match(appFuture, /rpc\('update_app_roadmap_item'/);
assert.doesNotMatch(appFuture, /\.from\('app_roadmap_items'\)\s*\n\s*\.update/);

const gate = readFileSync(join(process.cwd(), 'lib/admin/gate.ts'), 'utf-8');
assert.doesNotMatch(gate, /app_metadata/);

console.log('roadmap-hardening.test.ts: ok');
