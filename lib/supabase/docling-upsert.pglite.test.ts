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
    'supabase/migrations/20261022103000_docling_ingest_and_embedding_v2_rpcs.sql',
  );
  const raw = readFileSync(migrationPath, 'utf8');
  const start = raw.indexOf('CREATE OR REPLACE FUNCTION public._n8n_docling_validate_doc');
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
    chunker: 'md-sections-v1',
  };
  const sakChunks = [
    { chunk_index: 0, content: 'Avsnitt én.' },
    { chunk_index: 1, content: 'Avsnitt to.' },
  ];

  const crlfMarkdown = 'Linje én\r\nLinje to';
  const crlfHash = documentContentHash(crlfMarkdown);
  const crlfResult = await upsert(
    db,
    'sak',
    {
      issue_id: 'sak-1',
      document_id: 'doc-crlf',
      title: 'CRLF',
      content_markdown: crlfMarkdown,
      content_hash: crlfHash,
      chunker: 'md-sections-v1',
    },
    [{ chunk_index: 0, content: 'Linje én' }],
  );
  assert.notEqual(crlfResult.error, 'content_hash_mismatch');
  assert.equal(crlfResult.status, 'upserted');

  const bomMarkdown = 'Tittel med BOM\uFEFF på slutten';
  const bomHash = documentContentHash(bomMarkdown);
  const bomResult = await upsert(
    db,
    'sak',
    {
      issue_id: 'sak-1',
      document_id: 'doc-bom',
      title: 'BOM',
      content_markdown: bomMarkdown,
      content_hash: bomHash,
      chunker: 'md-sections-v1',
    },
    [{ chunk_index: 0, content: 'BOM test' }],
  );
  assert.notEqual(bomResult.error, 'content_hash_mismatch');
  assert.equal(bomResult.status, 'upserted');

  const nullPageCount = await upsert(
    db,
    'sak',
    {
      issue_id: 'sak-1',
      document_id: 'doc-null-pages',
      title: 'Pages',
      content_markdown: '# Ny',
      content_hash: documentContentHash('# Ny'),
      chunker: 'md-sections-v1',
      page_count: null,
    },
    [{ chunk_index: 0, content: 'Ny' }],
  );
  assert.equal(nullPageCount.status, 'upserted');

  const first = await upsert(db, 'sak', sakDoc, sakChunks);
  assert.equal(first.status, 'upserted');
  assert.equal(first.chunks, 2);

  const retry = await upsert(db, 'sak', sakDoc, sakChunks);
  assert.equal(retry.status, 'unchanged');

  const badPage = await upsert(db, 'sak', sakDoc, [
    { chunk_index: 0, content: 'x', page_start: 'nope' },
  ]);
  assert.equal(badPage.ok, false);
  assert.equal(badPage.error, 'invalid_chunk');
  assert.equal(badPage.field, 'page_start');

  const badFetchedAt = await upsert(db, 'sak', { ...sakDoc, fetched_at: 'not-a-date' }, sakChunks);
  assert.equal(badFetchedAt.ok, false);
  assert.equal(badFetchedAt.field, 'fetched_at');

  const badChunkIndex = await upsert(db, 'sak', sakDoc, [{ chunk_index: 2000, content: 'x' }]);
  assert.equal(badChunkIndex.ok, false);
  assert.equal(badChunkIndex.field, 'chunk_index');

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

  const chunkerMarkdown = markdown;
  const chunkerHash = hash;
  const chunkerDoc = {
    issue_id: 'sak-1',
    document_id: 'doc-chunker-loop',
    title: 'Chunker',
    content_markdown: chunkerMarkdown,
    content_hash: chunkerHash,
    chunker: 'md-sections-v2',
  };
  const chunkerChunks = [{ chunk_index: 0, content: 'Avsnitt én.' }];
  assert.equal((await upsert(db, 'sak', chunkerDoc, chunkerChunks)).status, 'upserted');
  const omit1 = await upsert(db, 'sak', {
    issue_id: 'sak-1',
    document_id: 'doc-chunker-loop',
    title: 'Chunker',
    content_markdown: chunkerMarkdown,
    content_hash: chunkerHash,
  }, chunkerChunks);
  assert.equal(omit1.status, 'unchanged', 'chunkerless payload keeps stored chunker for compare');
  const omit2 = await upsert(db, 'sak', {
    issue_id: 'sak-1',
    document_id: 'doc-chunker-loop',
    content_markdown: chunkerMarkdown,
    content_hash: chunkerHash,
  }, chunkerChunks);
  assert.equal(omit2.status, 'unchanged');
  const explicitV2 = await upsert(db, 'sak', { ...chunkerDoc, chunker: 'md-sections-v2' }, chunkerChunks);
  assert.equal(explicitV2.status, 'unchanged');
  const bumpV1 = await upsert(db, 'sak', { ...chunkerDoc, chunker: 'md-sections-v1' }, chunkerChunks);
  assert.equal(bumpV1.status, 'upserted', 'explicit chunker change must re-chunk');

  const hearingMarkdown = 'Høringstekst.';
  const hearingHash = documentContentHash(hearingMarkdown);
  const hearingDoc = {
    hearing_id: 'horing-1',
    document_id: 'hd-1',
    title: 'Høringsnotat',
    document_kind: 'notat',
    content_markdown: hearingMarkdown,
    content_hash: hearingHash,
    chunker: 'md-sections-v1',
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
  assert.equal(dup.ok, false);
  assert.equal(dup.error, 'invalid_chunk');
  assert.equal(dup.reason, 'duplicate');

  console.log('docling-upsert.pglite.test.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
