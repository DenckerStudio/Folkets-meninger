import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261027120000_reel_draft_soft_expiry.sql'),
  'utf-8',
);

assert.match(migration, /ADD COLUMN IF NOT EXISTS expired_at timestamptz/i);
assert.match(migration, /status IN \('draft', 'open', 'closed', 'archived', 'utløpt'\)/);
assert.match(migration, /polls_expired_at_pair_check/i);
assert.match(migration, /FUNCTION public\.n8n_expire_stale_reel_drafts/i);
assert.match(migration, /p\.track = 'system'/i);
assert.match(migration, /p\.status = 'draft'/i);
assert.match(migration, /status = 'utløpt'/i);
assert.match(migration, /SET search_path = public, pg_temp/i);
assert.match(migration, /FUNCTION public\.admin_restore_expired_reel_draft/i);
assert.match(migration, /require_admin_user_id\(p_admin_user_id\)/i);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.n8n_expire_stale_reel_drafts\(boolean, interval\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_expire_stale_reel_drafts\(boolean, interval\) TO service_role/i,
);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.admin_restore_expired_reel_draft\(uuid, uuid\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.admin_restore_expired_reel_draft\(uuid, uuid\) TO service_role/i,
);
assert.match(migration, /NOTIFY pgrst, 'reload schema'/i);

console.log('lib/polls/reel-draft-expiry-migration.test.ts: ok');
