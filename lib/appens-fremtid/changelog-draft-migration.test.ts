import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20261021180000_appens_fremtid_draft_status.sql',
);
const migration = readFileSync(migrationPath, 'utf8');

const dropNotNull = migration.indexOf('ALTER COLUMN published_at DROP NOT NULL');
const nullDraftUpdate = migration.indexOf(
  "SET published_at = NULL\nWHERE publication_status = 'draft'",
);
assert.ok(dropNotNull >= 0, 'migration must drop published_at NOT NULL');
assert.ok(nullDraftUpdate >= 0, 'migration must null draft published_at');
assert.ok(
  dropNotNull < nullDraftUpdate,
  'DROP NOT NULL must run before nulling draft published_at (2099 / future-dated rows)',
);

assert.match(migration, /SET search_path = public, pg_temp/);

/** Prod seed shape: far-future published_at used as draft hack before this migration. */
const futureDated = new Date('2099-06-01T00:00:00.000Z');
const now = new Date('2026-10-26T12:00:00.000Z');
const oneDayMs = 24 * 60 * 60 * 1000;

function classifyPublicationStatus(publishedAt: Date | null): 'draft' | 'published' {
  if (publishedAt === null) return 'draft';
  if (publishedAt.getTime() > now.getTime() + oneDayMs) return 'draft';
  if (publishedAt.getTime() >= new Date('2099-01-01T00:00:00.000Z').getTime()) return 'draft';
  return 'published';
}

assert.equal(classifyPublicationStatus(futureDated), 'draft');
assert.equal(classifyPublicationStatus(new Date('2026-01-01T00:00:00.000Z')), 'published');

console.log('appens-fremtid/changelog-draft-migration.test.ts: ok');
