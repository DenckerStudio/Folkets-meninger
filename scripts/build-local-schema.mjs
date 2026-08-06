#!/usr/bin/env node
/**
 * Rebuild supabase/migrations/20260806120000_folkets_stemme_schema.sql from
 * supabase/migrations_legacy/*.sql (sorted). Run after editing legacy files or
 * when adding a new archived incremental migration.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'supabase');
const legacyDir = path.join(root, 'migrations_legacy');
const migDir = path.join(root, 'migrations');
const outName = '20260806120000_folkets_stemme_schema.sql';
const outFile = path.join(migDir, outName);

const files = fs
  .readdirSync(legacyDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('No .sql files in supabase/migrations_legacy/');
  process.exit(1);
}

const parts = [
  '-- Folkets Stemme — squashed schema for local Supabase (`supabase db reset`).',
  '-- Built from incremental migrations in supabase/migrations_legacy/.',
  '-- Regenerate: node scripts/build-local-schema.mjs',
  '-- Do not apply to hosted DBs that already ran the incremental history.',
  '',
];

for (const file of files) {
  const sql = fs.readFileSync(path.join(legacyDir, file), 'utf8').trim();
  parts.push(`-- >>> BEGIN ${file}`);
  parts.push(sql);
  parts.push(`-- <<< END ${file}`);
  parts.push('');
}

fs.mkdirSync(migDir, { recursive: true });
fs.writeFileSync(outFile, parts.join('\n') + '\n');
console.log(`Wrote ${outFile} from ${files.length} legacy migrations.`);
