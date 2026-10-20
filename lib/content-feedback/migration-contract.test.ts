import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261021120000_content_feedback.sql'),
  'utf-8',
);

const guard = readFileSync(join(process.cwd(), 'supabase/tests/security-guard.sql'), 'utf-8');

const tables = [
  'content_feedback',
  'content_sources',
  'source_items',
  'feedback_profile',
];

for (const table of tables) {
  assert.match(
    migration,
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'),
  );
  assert.match(
    migration,
    new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated`, 'i'),
  );
}

assert.match(migration, /CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public/i);
assert.match(migration, /vector-extension må ligge i public \(fant %\)/i);
assert.doesNotMatch(migration, /ALTER EXTENSION vector SET SCHEMA/i);
assert.doesNotMatch(migration, /extensions\.vector/i);
assert.match(migration, /vector\(1024\)/i);
assert.match(migration, /bge-m3/i);
assert.match(migration, /embedding_model/i);
assert.match(migration, /modified_at/i);
assert.match(migration, /assert_bge_m3_embedding/i);
assert.match(migration, /parse_source_item_categories/i);
for (const fn of [
  'build_poll_reel_feedback_snapshot',
  'assert_bge_m3_embedding',
  'parse_source_item_categories',
  'normalize_content_source_domain',
]) {
  assert.match(
    migration,
    new RegExp(
      `REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*?FROM PUBLIC, anon, authenticated`,
      'i',
    ),
  );
}
assert.match(migration, /WHERE public\.content_feedback\.source = 'auto'/i);
assert.match(migration, /FUNCTION public\.log_blog_content_feedback/i);
assert.match(migration, /'skipped_admin'/i);
assert.match(migration, /'duplicate'/i);
assert.match(migration, /'stale'/i);
assert.match(migration, /RAISE WARNING 'log_poll_content_feedback/i);
assert.match(migration, /hnsw \(embedding vector_cosine_ops\)/i);
assert.match(migration, /polls_content_feedback_trg/i);
assert.match(migration, /NOTIFY pgrst, 'reload schema'/i);

for (const fn of ['upsert_content_feedback', 'log_blog_content_feedback']) {
  assert.match(migration, new RegExp(`FUNCTION public\\.${fn}`, 'i'));
  assert.match(
    migration,
    new RegExp(
      `REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*?FROM PUBLIC, anon, authenticated`,
      'i',
    ),
  );
  assert.match(
    migration,
    new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*?TO service_role`, 'i'),
  );
  assert.match(guard, new RegExp(`'${fn}'`));
}

for (const fn of [
  'n8n_feedback_examples',
  'n8n_feedback_similarity',
  'n8n_upsert_source_items',
  'n8n_match_source_items',
  'n8n_list_source_items',
  'n8n_upsert_feedback_profile',
  'n8n_set_feedback_embedding',
]) {
  assert.match(migration, new RegExp(`FUNCTION public\\.${fn}`, 'i'));
  assert.match(
    migration,
    new RegExp(
      `REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*?FROM PUBLIC, anon, authenticated`,
      'i',
    ),
  );
  assert.match(
    migration,
    new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*?TO service_role`, 'i'),
  );
}

assert.match(migration, /utenfilter\.no[\s\S]*primary[\s\S]*1\.50/i);
assert.match(migration, /ON CONFLICT \(domain\) DO NOTHING/i);
assert.match(migration, /base_url[\s\S]*https:\/\/www\.utenfilter\.no/i);
assert.match(migration, /'upserted', v_upserted/i);

console.log('content-feedback/migration-contract.test.ts: ok');
