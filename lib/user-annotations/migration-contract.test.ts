import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261115150000_user_annotations.sql'),
  'utf-8',
);

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.user_annotations/);
assert.match(migration, /target_type IN \('sak', 'research'\)/);
assert.match(migration, /ALTER TABLE public\.user_annotations ENABLE ROW LEVEL SECURITY/);
assert.match(
  migration,
  /REVOKE ALL ON TABLE public\.user_annotations FROM PUBLIC, anon, authenticated/,
);
assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.user_annotations TO authenticated/);
assert.match(migration, /GRANT ALL ON TABLE public\.user_annotations TO service_role/);
assert.doesNotMatch(migration, /GRANT[\s\S]*ON TABLE public\.user_annotations[\s\S]*TO anon/);

const policies = [
  'user_annotations_select_own',
  'user_annotations_insert_own',
  'user_annotations_update_own',
  'user_annotations_delete_own',
];

for (const policy of policies) {
  assert.match(migration, new RegExp(`CREATE POLICY ${policy}`, 'i'));
  assert.match(migration, /user_id = auth\.uid\(\)/);
}

assert.match(migration, /NOTIFY pgrst, 'reload schema'/);

console.log('user-annotations/migration-contract.test.ts: ok');