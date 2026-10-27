import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261027130000_require_admin_user_id_read_only.sql'),
  'utf-8',
);

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.require_admin_user_id\(p_actor uuid\)/i);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.app_future_require_admin\(p_admin_user_id uuid\)/i);
assert.match(migration, /\bSTABLE\b/i);

const requireBody = migration.match(
  /CREATE OR REPLACE FUNCTION public\.require_admin_user_id[\s\S]*?\$function\$;/
)?.[0];
assert.ok(requireBody, 'require_admin_user_id body');
assert.doesNotMatch(requireBody!, /ensure_public_user/i);

const appFutureBody = migration.match(
  /CREATE OR REPLACE FUNCTION public\.app_future_require_admin[\s\S]*?\$function\$;/
)?.[0];
assert.ok(appFutureBody, 'app_future_require_admin body');
assert.doesNotMatch(appFutureBody!, /ensure_public_user/i);

console.log('admin/require-admin-read-only-migration.test.ts: ok');
