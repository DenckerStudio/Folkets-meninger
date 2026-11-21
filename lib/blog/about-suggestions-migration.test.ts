import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261121180000_about_blog_suggestions.sql'),
  'utf8',
);

assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.about_blog_suggestions/);
assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
assert.match(sql, /REVOKE ALL ON TABLE public\.about_blog_suggestions FROM PUBLIC, anon, authenticated/);
assert.match(sql, /GRANT ALL ON TABLE public\.about_blog_suggestions TO service_role/);
assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.about_blog_suggestions TO authenticated/);
assert.match(sql, /USING \(public\.is_admin\(\)\)/);
assert.doesNotMatch(sql, /USING\s*\(\s*true\s*\)/i);
assert.doesNotMatch(sql, /TO anon/);
assert.doesNotMatch(sql, /research_topics\.title/);
assert.doesNotMatch(sql, /n8n_/);

console.log('lib/blog/about-suggestions-migration.test.ts ok');
