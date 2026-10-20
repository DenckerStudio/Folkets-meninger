import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const hearingPath = join(
  process.cwd(),
  'supabase/migrations/20261019210000_stortinget_hearings.sql',
);
const sql = readFileSync(hearingPath, 'utf8');

function extractFunctionArgTypes(sqlText: string, functionName: string, verb: 'REVOKE' | 'DROP'): string {
  const pattern =
    verb === 'REVOKE'
      ? new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${functionName}\\(\\s*([\\s\\S]*?)\\s*\\)\\s*FROM`,
          'm',
        )
      : new RegExp(
          `DROP FUNCTION IF EXISTS public\\.${functionName}\\(\\s*([\\s\\S]*?)\\s*\\)\\s*;`,
          'm',
        );
  const match = sqlText.match(pattern);
  assert.ok(match, `expected ${verb} for public.${functionName} in hearings migration`);
  return match[1]
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ');
}

const dropTypes = extractFunctionArgTypes(sql, 'search_chunks_hybrid', 'DROP');
const grantTypes = extractFunctionArgTypes(sql, 'search_chunks_hybrid', 'REVOKE');

assert.equal(
  dropTypes,
  grantTypes,
  'DROP FUNCTION signature must match REVOKE/GRANT for search_chunks_hybrid',
);
assert.equal(
  dropTypes,
  'text, vector, text[], text[], text, text, boolean, timestamptz, text, int',
);

console.log('supabase/hearing-hybrid-migration-signature.test.ts: ok');
