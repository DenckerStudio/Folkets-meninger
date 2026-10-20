import assert from 'node:assert/strict';
import { seedAdminFromEnv, SeedConfigError } from './seedBaseData';

assert.throws(() => seedAdminFromEnv({}), SeedConfigError);
assert.throws(
  () => seedAdminFromEnv({ SEED_ADMIN_EMAIL: 'a@b.no', SEED_ADMIN_PASSWORD: 'short' }),
  SeedConfigError,
);

const ok = seedAdminFromEnv({
  SEED_ADMIN_EMAIL: 'admin@folkets-meninger.no',
  SEED_ADMIN_PASSWORD: 'long-enough-secret',
});
assert.equal(ok.email, 'admin@folkets-meninger.no');

console.log('cms/src/seed/seedBaseData.test.ts ok');
