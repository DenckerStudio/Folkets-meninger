import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20261019210000_stortinget_hearings.sql',
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

let hybridMigration = '';
try {
  hybridMigration = execSync(
    'git show origin/cursor/hybrid-search-rag-p4-p6-fff8:supabase/migrations/20261019200000_hybrid_search_and_embedding_v2.sql',
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
} catch {
  const localHybrid = join(
    process.cwd(),
    'supabase/migrations/20261019200000_hybrid_search_and_embedding_v2.sql',
  );
  try {
    hybridMigration = readFileSync(localHybrid, 'utf8');
  } catch {
    hybridMigration = '';
  }
}

if (hybridMigration) {
  assert.match(hybridMigration, /CREATE OR REPLACE FUNCTION public\.search_chunks_hybrid/);
  assert.match(hybridMigration, /filter_hearing_id text DEFAULT NULL/);
  assert.doesNotMatch(
    hybridMigration,
    /DROP FUNCTION IF EXISTS public\.search_chunks_hybrid/,
    '#179 must not drop search_chunks_hybrid; #178 drops before extending return type',
  );
}

console.log('supabase/stortinget-hearings-migration.test.ts: ok');
