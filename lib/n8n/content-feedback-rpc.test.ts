import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261021120000_content_feedback.sql'),
  'utf-8',
);

const doc = readFileSync(
  join(process.cwd(), 'docs/n8n/content-feedback-contract.md'),
  'utf-8',
);

assert.match(migration, /FUNCTION public\.n8n_list_source_items/i);
assert.match(migration, /normalize_content_source_domain/i);
assert.match(doc, /n8n_upsert_source_items/);
assert.match(doc, /"upserted"/);
assert.match(doc, /bge-m3/);
assert.match(doc, /vector\(1024\)/);
assert.match(migration, /log_blog_content_feedback/i);
assert.match(doc, /log_blog_content_feedback/);
assert.match(doc, /`excerpt`/);
assert.match(doc, /`seen_at`/);
assert.match(doc, /COALESCE\(modified_at, published_at, fetched_at\)/);

console.log('n8n/content-feedback-rpc.test.ts: ok');
