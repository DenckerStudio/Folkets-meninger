import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HYBRID_REF = 'origin/cursor/hybrid-search-rag-p4-p6-fff8';
const hybridPath =
  'supabase/migrations/20261019200000_hybrid_search_and_embedding_v2.sql';
const hearingPath = 'supabase/migrations/20261019210000_stortinget_hearings.sql';

function extractFunctionArgTypes(sql: string, functionName: string): string {
  const pattern = new RegExp(
    `REVOKE ALL ON FUNCTION public\\.${functionName}\\(\\s*([\\s\\S]*?)\\s*\\)\\s*FROM`,
    'm',
  );
  const match = sql.match(pattern);
  assert.ok(match, `expected REVOKE ALL ON FUNCTION public.${functionName}(...) in migration`);
  return match[1]
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ');
}

function extractDropArgTypes(sql: string, functionName: string): string {
  const pattern = new RegExp(
    `DROP FUNCTION IF EXISTS public\\.${functionName}\\(\\s*([\\s\\S]*?)\\s*\\)\\s*;`,
    'm',
  );
  const match = sql.match(pattern);
  assert.ok(match, `expected DROP FUNCTION IF EXISTS public.${functionName}(...) in migration`);
  return match[1]
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ');
}

const hybridSql = execSync(`git show ${HYBRID_REF}:${hybridPath}`, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const hearingSql = readFileSync(join(process.cwd(), hearingPath), 'utf8');

const grantTypes = extractFunctionArgTypes(hybridSql, 'search_chunks_hybrid');
const dropTypes = extractDropArgTypes(hearingSql, 'search_chunks_hybrid');

assert.equal(
  dropTypes,
  grantTypes,
  'DROP FUNCTION arg types must match #179 REVOKE/GRANT signature on cursor/hybrid-search-rag-p4-p6-fff8',
);

assert.match(hybridSql, /filter_hearing_id text DEFAULT NULL/);
assert.doesNotMatch(
  hybridSql,
  /DROP FUNCTION IF EXISTS public\.search_chunks_hybrid/,
  '#179 must not drop search_chunks_hybrid; #178 drops before extending return type',
);

assert.match(hybridSql, /DROP FUNCTION IF EXISTS public\.search_issues_fts\(text, int\)/);
assert.match(hybridSql, /search_terms text\[\] DEFAULT NULL/);

console.log('supabase/hearing-hybrid-migration-signature.test.ts: ok');
