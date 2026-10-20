import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20261022102000_stortinget_hearings.sql',
);
const sql = readFileSync(migrationPath, 'utf8');

assert.doesNotMatch(
  sql,
  /DROP CONSTRAINT\s+document_chunks_issue_id_document_id_chunk_index_key/i,
  'must not drop sak chunk unique constraint (breaks ON CONFLICT upserts)',
);

assert.match(
  sql,
  /ADD CONSTRAINT document_chunks_issue_id_document_id_chunk_index_key\s+UNIQUE \(issue_id, document_id, chunk_index\)/,
);

assert.match(sql, /document_chunks_hearing_doc_chunk_key/);
assert.match(sql, /JOIN public\.hearing_documents hd ON hd\.id = dc\.hearing_document_id/);
assert.match(sql, /AND dc\.hearing_id = p\.hearing_id/);
assert.match(sql, /hearing_id text,\s+hearing_document_id uuid/);
assert.match(
  sql,
  /DROP FUNCTION IF EXISTS public\.search_chunks_hybrid\(\s*text,\s*vector,\s*text\[\],\s*text\[\],\s*text,\s*text,\s*boolean,\s*timestamptz,\s*text,\s*int\s*\)/,
);
const dropAt = sql.search(/DROP FUNCTION IF EXISTS public\.search_chunks_hybrid/);
const createAt = sql.indexOf('CREATE OR REPLACE FUNCTION public.search_chunks_hybrid');
assert.ok(dropAt >= 0 && createAt > dropAt, 'must DROP search_chunks_hybrid before CREATE');
assert.match(sql, /n8n_replace_hearing_document_chunks/);

console.log('supabase/stortinget-hearings-migration.test.ts: ok');
