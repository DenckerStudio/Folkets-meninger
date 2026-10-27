import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrations } from '../migrations/index';

const migrationDir = fileURLToPath(new URL('../migrations/', import.meta.url));
const sqlSource = readFileSync(`${migrationDir}20261027_120000_posts_expired_at.ts`, 'utf8');

assert.match(sqlSource, /expired_at/);
assert.match(sqlSource, /version_expired_at/);
assert.equal(migrations.some((m) => m.name === '20261027_120000_posts_expired_at'), true);

console.log('cms/src/migration-tests/postsExpiredAt.migration.test.ts ok');
