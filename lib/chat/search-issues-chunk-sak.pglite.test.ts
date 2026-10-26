/**
 * chunk_sak must query document_chunks.tsv with raw Norwegian websearch (not fm_unaccent),
 * so stems like bok match bøker in chunk text.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

function loadSearchIssuesFtsFrom080(): string {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261022108000_rag_issue_search_sak_prefix.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.fm_escape_ilike');
  const end = sql.indexOf('REVOKE ALL ON FUNCTION public.search_issues_fts');
  assert.ok(start >= 0 && end > start, 'could not slice search_issues_fts from 080 migration');
  return sql.slice(start, end);
}

const FM_UNACCENT_STUB = `
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE OR REPLACE FUNCTION extensions.similarity(text, text)
RETURNS real LANGUAGE sql IMMUTABLE AS $$ SELECT 0::real $$;
CREATE OR REPLACE FUNCTION extensions.word_similarity(text, text)
RETURNS real LANGUAGE sql IMMUTABLE AS $$ SELECT 0::real $$;
CREATE OR REPLACE FUNCTION public.fm_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT translate(lower($1), 'æøå', 'aoa')
$$;
`;

async function main() {
  const db = new PGlite();
  await db.exec(FM_UNACCENT_STUB);
  await db.exec(`
    CREATE TABLE public.stortinget_issues (
      id text PRIMARY KEY,
      title text,
      summary text,
      henvisning text,
      ferdigbehandlet boolean,
      last_synced_at timestamptz,
      detail_json jsonb,
      tsv tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('norwegian', coalesce(public.fm_unaccent(title), '')), 'A')
        || setweight(to_tsvector('norwegian', coalesce(public.fm_unaccent(summary), '')), 'B')
      ) STORED
    );
    CREATE TABLE public.document_chunks (
      id uuid PRIMARY KEY,
      issue_id text NOT NULL,
      document_id text,
      chunk_index int NOT NULL DEFAULT 0,
      content text NOT NULL,
      tsv tsvector GENERATED ALWAYS AS (
        to_tsvector('norwegian', coalesce(content, ''))
      ) STORED
    );
    CREATE TABLE public.stortinget_hearings (
      id text PRIMARY KEY,
      related_issue_ids text[] NOT NULL DEFAULT '{}'
    );
  `);
  await db.exec(loadSearchIssuesFtsFrom080());

  await db.query(`
    INSERT INTO public.stortinget_issues (id, title, summary, henvisning, ferdigbehandlet, last_synced_at)
    VALUES ('bok-sak', 'Generell skolepolitikk', 'Kort.', NULL, false, now())
  `);
  await db.query(`
    INSERT INTO public.document_chunks (id, issue_id, document_id, chunk_index, content)
    VALUES ('00000000-0000-4000-8000-000000000001', 'bok-sak', 'doc-1', 0, 'Skolen trenger flere bøker til biblioteket.')
  `);

  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM public.search_issues_fts('bøker', NULL::text[], 6)`,
  );
  assert.ok(
    rows.some((r) => r.id === 'bok-sak'),
    `expected chunk_sak (raw websearch on chunk tsv) to surface bok-sak for bøker, got: ${JSON.stringify(rows)}`,
  );

  const unaccentMismatch = await db.query<{ hit: boolean }>(`
    SELECT to_tsvector('norwegian', 'flere bøker') @@ websearch_to_tsquery(
      'norwegian',
      public.fm_unaccent('bøker')
    ) AS hit
  `);
  assert.equal(
    unaccentMismatch.rows[0]?.hit,
    false,
    'fm_unaccent on query must not be the chunk_tsq path (æ/ø/å stem drift)',
  );

  console.log('chat/search-issues-chunk-sak.pglite.test.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
