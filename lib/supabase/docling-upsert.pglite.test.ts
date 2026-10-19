import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { documentContentHash } from '../document-chunking';

const repoRoot = path.resolve(import.meta.dirname, '../..');

function loadDoclingRpcSql(): string {
  const migrationPath = path.join(
    repoRoot,
    'supabase/migrations/20261019220000_docling_ingest_and_embedding_v2_rpcs.sql',
  );
  const raw = readFileSync(migrationPath, 'utf8');
  const start = raw.indexOf('CREATE OR REPLACE FUNCTION public._n8n_docling_validate_chunks');
  const end = raw.indexOf('-- embedding_v2 backfill');
  assert.ok(start >= 0 && end > start, 'docling RPC section missing in migration');
  return raw
    .slice(start, end)
    .replace(/^REVOKE ALL ON FUNCTION[\s\S]*?;$/gm, '')
    .replace(/^GRANT EXECUTE ON FUNCTION[\s\S]*?;$/gm, '');
}

async function createDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  const schemaPath = path.join(repoRoot, 'supabase/tests/pglite-docling-upsert-schema.sql');
  await db.exec(readFileSync(schemaPath, 'utf8'));
  await db.exec(loadDoclingRpcSql());
  return db;
}

async function upsert(
  db: PGlite,
  target: 'sak' | 'horing',
  doc: Record<string, unknown>,
  chunks: Record<string, unknown>[],
): Promise<Record<string, unknown>> {
  const rows = await db.query<{ n8n_upsert_docling_document: Record<string, unknown> }>(
    `SELECT public.n8n_upsert_docling_document($1, $2::jsonb, $3::jsonb) AS n8n_upsert_docling_document`,
    [target, JSON.stringify(doc), JSON.stringify(chunks)],
  );
  return rows.rows[0]?.n8n_upsert_docling_document ?? {};
}

async function main(): Promise<void> {
  const db = await createDb();
  const markdown = '# Tittel\n\nAvsnitt én.';
  const hash = documentContentHash(markdown);

  const sakDoc = {
    issue_id: 'sak-1',
    document_id: 'doc-a',
    title: 'Første',
    document_type: 'innstilling',
    content_markdown: markdown,
    content_hash: hash,
  };
  const sakChunks = [
    { chunk_index: 0, content: 'Avsnitt én.' },
    { chunk_index: 1, content: 'Avsnitt to.' },
  ];

  const first = await upsert(db, 'sak', sakDoc, sakChunks);
  assert.equal(first.status, 'upserted');
  assert.equal(first.chunks, 2);

  const retry = await upsert(db, 'sak', sakDoc, sakChunks);
  assert.equal(retry.status, 'unchanged');

  const badPage = await upsert(db, 'sak', sakDoc, [
    { chunk_index: 0, content: 'x', page_start: 'nope' },
  ]);
  assert.equal(badPage.status, 'error');
  assert.equal(badPage.error, 'invalid_page_start');

  const afterBad = await upsert(db, 'sak', sakDoc, sakChunks);
  assert.equal(afterBad.status, 'unchanged', 'invalid payload must not partial-write');

  const appended = markdown + '\n\nNy seksjon.';
  const keepTitle = await upsert(
    db,
    'sak',
    {
      ...sakDoc,
      title: '',
      content_markdown: appended,
      content_hash: documentContentHash(appended),
    },
    [
      { chunk_index: 0, content: 'Avsnitt én.' },
      { chunk_index: 1, content: 'Ny seksjon tekst.' },
    ],
  );
  assert.equal(keepTitle.status, 'upserted');
  const titleRow = await db.query<{ title: string }>(
    `SELECT title FROM public.stortinget_issue_documents WHERE issue_id = 'sak-1' AND document_id = 'doc-a'`,
  );
  assert.equal(titleRow.rows[0]?.title, 'Første', 'explicit empty title must not wipe');

  const hearingMarkdown = 'Høringstekst.';
  const hearingHash = documentContentHash(hearingMarkdown);
  const hearingDoc = {
    hearing_id: 'horing-1',
    document_id: 'hd-1',
    title: 'Høringsnotat',
    document_kind: 'notat',
    content_markdown: hearingMarkdown,
    content_hash: hearingHash,
  };
  const hearingChunks = [
    { chunk_index: 0, content: 'Del 1' },
    { chunk_index: 1, content: 'Del 2' },
  ];

  const hFirst = await upsert(db, 'horing', hearingDoc, hearingChunks);
  assert.equal(hFirst.status, 'upserted');

  const hRetry = await upsert(db, 'horing', hearingDoc, hearingChunks);
  assert.equal(hRetry.status, 'unchanged');

  const hUpdate = await upsert(db, 'horing', {
    ...hearingDoc,
    content_markdown: hearingMarkdown + '\n\nMer.',
    content_hash: documentContentHash(hearingMarkdown + '\n\nMer.'),
  }, [
    { chunk_index: 0, content: 'Del 1 oppdatert' },
    { chunk_index: 1, content: 'Del 2' },
  ]);
  assert.equal(hUpdate.status, 'upserted');

  const chunkRows = await db.query<{ chunk_index: number; content: string }>(
    `SELECT chunk_index, content FROM public.document_chunks
     WHERE hearing_id = 'horing-1' ORDER BY chunk_index`,
  );
  assert.equal(chunkRows.rows.length, 2);
  assert.match(chunkRows.rows[0]?.content ?? '', /oppdatert/);

  const dup = await upsert(db, 'horing', hearingDoc, [
    { chunk_index: 0, content: 'a' },
    { chunk_index: 0, content: 'b' },
  ]);
  assert.equal(dup.status, 'error');
  assert.equal(dup.error, 'duplicate_chunk_index');

  console.log('docling-upsert.pglite.test.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
