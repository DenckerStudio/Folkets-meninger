import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const repoRoot = path.resolve(import.meta.dirname, '../..');

const MIGRATION_COLUMNS = [
  'content_html',
  'content_full_text',
  'mime_type',
  'ingest_status',
  'chunks_status',
  'content_markdown',
  'markdown_source',
  'page_count',
  'ingest_version',
  'chunker',
  'pdf_url',
] as const;

function loadRepairMigrationSql(): string {
  const migrationPath = path.join(
    repoRoot,
    'supabase/migrations/20261115020000_stortinget_issue_documents_missing_columns.sql',
  );
  return readFileSync(migrationPath, 'utf8');
}

async function createProdLikeDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE public.stortinget_issues (
      id text PRIMARY KEY
    );
    CREATE TABLE public.stortinget_issue_documents (
      issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
      document_id text NOT NULL,
      title text,
      document_type text,
      text_excerpt text,
      source_url text,
      content_hash text,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (issue_id, document_id)
    );
    INSERT INTO public.stortinget_issues (id) VALUES ('200506');
  `);
  return db;
}

async function columnNames(db: PGlite): Promise<Set<string>> {
  const result = await db.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'stortinget_issue_documents'`,
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function main(): Promise<void> {
  const sql = loadRepairMigrationSql();
  const db = await createProdLikeDb();
  const before = await columnNames(db);
  assert.equal(before.has('chunks_status'), false);

  await db.exec(sql);
  await db.exec(sql);

  const after = await columnNames(db);
  for (const name of MIGRATION_COLUMNS) {
    assert.equal(after.has(name), true, `expected column ${name}`);
  }

  await db.query(
    `INSERT INTO public.stortinget_issue_documents (
      issue_id, document_id, title, document_type, source_url,
      text_excerpt, content_html, content_full_text, mime_type,
      ingest_status, chunks_status, content_hash, fetched_at
    ) VALUES (
      '200506', 'doc-1', 'Test', 'innstilling', 'https://example.test/doc',
      'utdrag', NULL, 'full tekst', 'text/html',
      'ready', 'pending', 'hash-1', now()
    )
    ON CONFLICT (issue_id, document_id) DO UPDATE SET chunks_status = EXCLUDED.chunks_status`,
  );

  const row = await db.query<{ chunks_status: string; ingest_status: string }>(
    `SELECT chunks_status, ingest_status
     FROM public.stortinget_issue_documents
     WHERE issue_id = '200506' AND document_id = 'doc-1'`,
  );
  assert.equal(row.rows[0]?.chunks_status, 'pending');
  assert.equal(row.rows[0]?.ingest_status, 'ready');

  const index = await db.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'stortinget_issue_documents'
       AND indexname = 'stortinget_issue_documents_chunks_pending_idx'`,
  );
  assert.equal(index.rows.length, 1);

  console.log('stortinget-issue-documents-columns.test.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});