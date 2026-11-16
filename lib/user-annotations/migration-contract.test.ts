import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const baseMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261115150000_user_annotations.sql'),
  'utf-8',
);

assert.match(baseMigration, /CREATE TABLE IF NOT EXISTS public\.user_annotations/);
assert.match(baseMigration, /target_type IN \('sak', 'research'\)/);
assert.match(baseMigration, /ALTER TABLE public\.user_annotations ENABLE ROW LEVEL SECURITY/);

const adminMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261116153000_user_annotations_admin_research.sql'),
  'utf-8',
);

assert.match(adminMigration, /flag_type/);
assert.match(adminMigration, /research_topic/);
assert.match(adminMigration, /user_annotations_select_admin/);
assert.match(adminMigration, /public\.is_admin\(\)/);
assert.match(adminMigration, /user_annotations_insert_admin/);
assert.match(adminMigration, /target_type IN \('research', 'research_topic'\)/);
assert.match(
  adminMigration,
  /REVOKE ALL ON TABLE public\.user_annotations FROM PUBLIC, anon, authenticated/,
);
assert.match(adminMigration, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.user_annotations TO authenticated/);
assert.match(adminMigration, /GRANT ALL ON TABLE public\.user_annotations TO service_role/);
assert.match(adminMigration, /NOTIFY pgrst, 'reload schema'/);

console.log('user-annotations/migration-contract.test.ts: ok');