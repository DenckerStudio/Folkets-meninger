import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { FTS_CONFIG, buildOrTsQuery } from './fts';

assert.equal(FTS_CONFIG, 'norwegian');
assert.equal(buildOrTsQuery(['barnehager', 'kommunene']), 'barnehager | kommunene');
// Operators and quotes from user input never reach to_tsquery.
assert.equal(buildOrTsQuery(["vekt'grense & !x", 'b|c']), 'vekt | grense');
assert.equal(buildOrTsQuery(['!', ' ']), null);
assert.equal(buildOrTsQuery(['Øl', 'ØL']), 'øl');

// The migration that builds the columns uses the same config.
const dir = new URL('../../supabase/migrations/', import.meta.url);
const file = readdirSync(dir).find((name) => name.endsWith('_fts_norwegian.sql'));
assert.ok(file, 'fts_norwegian migration missing');
// Assert on SQL only; comments may mention the old config.
const sql = readFileSync(new URL(file, dir), 'utf8').replace(/--.*$/gm, '');
assert.match(sql, /to_tsvector\('norwegian'::regconfig, coalesce\(content, ''\)\)/);
assert.match(sql, /websearch_to_tsquery\('norwegian'::regconfig/);
assert.match(sql, /SECURITY INVOKER/);
assert.doesNotMatch(sql, /'simple'/);
assert.doesNotMatch(sql, /embedding/);

console.log('lib/search/fts.test.ts ok');
