import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261102103527_hide_retired_system_polls.sql'),
  'utf8',
);

assert.match(migration, /BEGIN;/i);
assert.match(migration, /COMMIT;/i);
assert.match(migration, /polls_select_public[\s\S]*track <> 'system'/i);
assert.match(migration, /polls_select_admin[\s\S]*is_admin\(\)/i);
assert.match(migration, /poll_allows_public_aggregate/i);
assert.match(migration, /get_poll_totals[\s\S]*poll_allows_public_aggregate/i);
assert.match(migration, /get_poll_totals_by_fylke[\s\S]*poll_allows_public_aggregate/i);
assert.match(migration, /cast_poll_vote[\s\S]*v_poll\.track = 'system'/i);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.get_poll_totals\(uuid\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.get_poll_totals\(uuid\) TO anon, authenticated, service_role/i,
);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.cast_poll_vote\(uuid, uuid, text\) FROM PUBLIC, anon, authenticated/i,
);

console.log('hide-retired-system-migration.test.ts: ok');
