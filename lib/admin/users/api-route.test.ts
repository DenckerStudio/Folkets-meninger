import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AdminUsersServiceError,
  serviceErrorStatus,
} from '@/lib/admin/users/service';
import { ADMIN_HARD_DELETE_STRIPE_BLOCK_MESSAGE } from '@/lib/admin/users/constants';
import { isStripeSubscriptionEntitled } from '@/lib/stripe/subscription';
import {
  adminUserBulkSchema,
  adminUserListQuerySchema,
} from '@/lib/admin/users/schemas';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261102180000_admin_users.sql'),
  'utf-8',
);

const listRoute = readFileSync(join(process.cwd(), 'app/api/admin/users/route.ts'), 'utf-8');
const detailRoute = readFileSync(
  join(process.cwd(), 'app/api/admin/users/[id]/route.ts'),
  'utf-8',
);

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.admin_audit_log/);
assert.match(
  migration,
  /ALTER TABLE public\.admin_audit_log ENABLE ROW LEVEL SECURITY/i,
);
assert.match(
  migration,
  /REVOKE ALL ON TABLE public\.admin_audit_log FROM PUBLIC, anon, authenticated/i,
);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_list_users/i);
assert.match(migration, /require_admin_user_id\(p_admin_user_id\)/i);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.admin_list_users[\s\S]*FROM PUBLIC, anon, authenticated/i,
);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_list_users/i);

assert.match(listRoute, /requireAdmin\(\)/);
assert.match(listRoute, /status: 503/);
assert.match(listRoute, /adminUserListQuerySchema/);
assert.match(listRoute, /status: 400/);
assert.match(detailRoute, /requireAdmin\(\)/);
assert.match(detailRoute, /adminUserDeleteQuerySchema/);
assert.match(detailRoute, /deactivateAdminUser/);
assert.match(detailRoute, /anonymizeAdminUserProfile/);
assert.match(detailRoute, /confirmEmail/);
assert.match(detailRoute, /status: 503/);

const listQuery = adminUserListQuerySchema.safeParse({ page: '2', pageSize: '50' });
assert.equal(listQuery.success, true);
if (listQuery.success) {
  assert.equal(listQuery.data.page, 2);
  assert.equal(listQuery.data.pageSize, 50);
}

const bulk = adminUserBulkSchema.safeParse({
  userIds: ['00000000-0000-4000-8000-000000000001'],
  action: 'deactivate',
});
assert.equal(bulk.success, true);

const selfError = new AdminUsersServiceError('Du kan ikke endre din egen konto', 'conflict');
assert.equal(serviceErrorStatus(selfError), 409);

const stripeError = new AdminUsersServiceError(
  ADMIN_HARD_DELETE_STRIPE_BLOCK_MESSAGE,
  'conflict',
  'stripe_subscription',
);
assert.equal(serviceErrorStatus(stripeError), 409);

assert.equal(isStripeSubscriptionEntitled('active'), true);
assert.equal(isStripeSubscriptionEntitled('canceled'), false);

const misconfigured = new AdminUsersServiceError('Serveren er ikke konfigurert', 'misconfigured');
assert.equal(serviceErrorStatus(misconfigured), 503);

console.log('lib/admin/users/api-route.test.ts: ok');
