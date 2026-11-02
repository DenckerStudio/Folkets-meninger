import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261102120000_admin_publish_stortinget_poll.sql'),
  'utf8',
);

const guard = readFileSync(join(process.cwd(), 'supabase/tests/security-guard.sql'), 'utf-8');

assert.match(migration, /BEGIN;/i);
assert.match(migration, /COMMIT;/i);
assert.match(migration, /set_config\('app\.skip_poll_feedback', 'on', true\)/i);
assert.match(
  migration,
  /current_setting\('app\.skip_poll_feedback', true\) = 'on'/i,
);
assert.match(migration, /FUNCTION public\.admin_publish_stortinget_poll/i);
assert.match(migration, /SET search_path = public, pg_temp/i);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.admin_publish_stortinget_poll\(text, text, text, jsonb, timestamptz, boolean\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.admin_publish_stortinget_poll\(text, text, text, jsonb, timestamptz, boolean\) TO service_role/i,
);
assert.match(migration, /ON CONFLICT \(id\) DO UPDATE SET[\s\S]*last_synced_at = now\(\)/i);
assert.doesNotMatch(
  migration,
  /ON CONFLICT \(id\) DO UPDATE SET[\s\S]*title = coalesce/i,
);
assert.match(guard, /'admin_publish_stortinget_poll'/);

console.log('admin-publish-stortinget-poll-migration.test.ts: ok');
