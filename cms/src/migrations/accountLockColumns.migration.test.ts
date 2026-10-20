import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrations } from './index';

const migrationDir = fileURLToPath(new URL('.', import.meta.url));
const sqlSource = readFileSync(
  `${migrationDir}20261020_120000_users_account_lock_columns.ts`,
  'utf8',
);

assert.match(sqlSource, /login_attempts/);
assert.match(sqlSource, /lock_until/);
assert.equal(
  migrations.some((m) => m.name === '20261020_120000_users_account_lock_columns'),
  true,
);

console.log('cms/src/migrations/accountLockColumns.migration.test.ts ok');
