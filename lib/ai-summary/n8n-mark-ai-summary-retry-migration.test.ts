import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261027143000_n8n_mark_ai_summary_retry.sql'),
  'utf-8',
);

assert.match(migration, /FUNCTION public\.n8n_mark_ai_summary_retry\(text, boolean\)/i);
assert.match(migration, /p_force boolean DEFAULT false/i);
assert.match(migration, /ai_summary_requested_at = NULL/i);
assert.match(migration, /regeneration_requested_at = now\(\)/i);
assert.match(migration, /regeneration_attempts = 0/i);
assert.match(migration, /SET search_path = public, pg_temp/i);
assert.match(migration, /SECURITY DEFINER/i);
assert.match(migration, /RETURN v_issue_updated/i);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.n8n_mark_ai_summary_retry\(text, boolean\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_mark_ai_summary_retry\(text, boolean\) TO service_role/i,
);
assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.n8n_mark_ai_summary_retry[\s\S]*TO authenticated/i);
assert.match(migration, /NOTIFY pgrst, 'reload schema'/i);

console.log('lib/ai-summary/n8n-mark-ai-summary-retry-migration.test.ts: ok');
