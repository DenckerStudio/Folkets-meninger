/**
 * Executes search_issues_fts from the hybrid migration against PGlite (real Postgres FTS).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

function loadSearchIssuesFtsSql(): string {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261019200000_hybrid_search_and_embedding_v2.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const start = sql.indexOf('DROP FUNCTION IF EXISTS public.search_issues_fts(text, int);');
  assert.ok(start >= 0, 'search_issues_fts DROP block missing from migration');
  const end = sql.indexOf('-- Hybrid chunk search', start);
  assert.ok(end > start, 'search_issues_fts end marker missing from migration');
  return sql.slice(start, end);
}

async function main() {
  const db = new PGlite();
  await db.exec(`
    DO $$ BEGIN
      CREATE ROLE anon;
      CREATE ROLE authenticated;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
    CREATE TABLE public.stortinget_issues (
      id text PRIMARY KEY,
      title text,
      summary text,
      henvisning text,
      ferdigbehandlet boolean,
      last_synced_at timestamptz,
      tsv tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('norwegian', coalesce(title, '')), 'A')
        || setweight(to_tsvector('norwegian', coalesce(henvisning, '')), 'A')
        || setweight(to_tsvector('norwegian', coalesce(summary, '')), 'B')
      ) STORED
    );
  `);
  await db.exec(loadSearchIssuesFtsSql());

  const paddedSummary =
    'Bakgrunn og kontekst uten temaord. '.repeat(40) + 'innvandring i en setning. ';
  await db.query(
    `
    INSERT INTO public.stortinget_issues (id, title, summary, henvisning, ferdigbehandlet, last_synced_at)
    VALUES
      ('bud-2024', 'Statsbudsjett 2024', 'Kort om perioden 2024 og videre.', NULL, false, now()),
      ('veg', 'Vegvedlikehold', 'Ingen budsjettreferanse.', NULL, false, now()),
      ('innv-title', 'Innvandringsloven', 'Kort.', NULL, false, now()),
      ('innv-summary', 'Skattereform', $1, NULL, false, now())
    `,
    [paddedSummary],
  );

  type FtsRow = { id: string; rank: number };

  async function fts(
    queryText: string,
    searchTerms: string[] | null,
    matchCount = 6,
  ): Promise<FtsRow[]> {
    const { rows } = await db.query<FtsRow>(
      `SELECT id, rank::float8 AS rank
       FROM public.search_issues_fts($1::text, $2::text[], $3::int)`,
      [queryText, searchTerms, matchCount],
    );
    return rows;
  }

  const slash = await fts('2024/25', ['2024/25']);
  assert.ok(
    slash.some((r) => r.id === 'bud-2024'),
    `expected 2024/25 prefix split to match bud-2024, got: ${JSON.stringify(slash)}`,
  );
  assert.ok(
    !slash.some((r) => r.id === 'veg'),
    '2024/25 should not match unrelated sak',
  );

  const shortX = await fts('x', ['x']);
  assert.equal(
    shortX.length,
    0,
    `single-char term x must not produce prefix matches, got: ${JSON.stringify(shortX)}`,
  );

  const innv = await fts('innvandring', ['innvandring']);
  assert.ok(
    innv.some((r) => r.id === 'innv-title'),
    `innvandring should match title, got: ${JSON.stringify(innv)}`,
  );

  const special = await fts('innvandring!!!', ['innvandring!!!', '@@@']);
  assert.ok(
    special.some((r) => r.id === 'innv-title'),
    `special chars around innvandring should still match, got: ${JSON.stringify(special)}`,
  );

  const ranked = await fts('innvandring', ['innvandring'], 10);
  const ids = ranked.map((r) => r.id);
  const titleRow = ranked.find((r) => r.id === 'innv-title');
  const summaryRow = ranked.find((r) => r.id === 'innv-summary');
  assert.ok(titleRow && summaryRow, `expected both innv rows in: ${ids.join(',')}`);
  assert.ok(
    titleRow!.rank > summaryRow!.rank,
    `A-weight title should outrank B-weight mention in padded summary (ranks ${titleRow!.rank} vs ${summaryRow!.rank})`,
  );

  console.log('chat/search-issues-fts.pglite.test.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
