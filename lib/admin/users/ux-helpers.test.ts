import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatAdminBulkResultSummary } from '@/lib/admin/users/bulk-result-summary';
import { ADMIN_DEACTIVATE_STRIPE_BLOCK_MESSAGE } from '@/lib/admin/users/constants';
import { formatDeactivateConfirmTitle } from '@/lib/admin/users/deactivate-copy';
import { adminEmailsMatchForConfirm } from '@/lib/admin/users/email-confirm';
import {
  AdminUsersServiceError,
  serviceErrorStatus,
} from '@/lib/admin/users/service';
import type { AdminBulkItemResult } from '@/lib/admin/users/types';

const serviceSource = readFileSync(
  join(process.cwd(), 'lib/admin/users/service.ts'),
  'utf-8',
);

assert.match(serviceSource, /assertDeactivationAllowed/);
assert.match(serviceSource, /ADMIN_DEACTIVATE_STRIPE_BLOCK_MESSAGE/);
assert.match(serviceSource, /deactivateAdminUser[\s\S]*assertDeactivationAllowed/);

const stripeDeactivateError = new AdminUsersServiceError(
  ADMIN_DEACTIVATE_STRIPE_BLOCK_MESSAGE,
  'conflict',
  'stripe_subscription',
);
assert.equal(serviceErrorStatus(stripeDeactivateError), 409);
assert.equal(stripeDeactivateError.conflictKind, 'stripe_subscription');

const bulkResults: AdminBulkItemResult[] = [
  { userId: 'a', ok: true },
  { userId: 'b', ok: false, reason: 'stripe_subscription', message: 'stripe' },
  { userId: 'c', ok: false, reason: 'self', message: 'self' },
];

const summary = formatAdminBulkResultSummary(bulkResults);
assert.equal(summary.completed, 1);
assert.equal(summary.skipped, 2);
assert.match(summary.message, /1 fullført, 2 hoppet over/);
assert.match(summary.message, /aktivt Stemme\+/);

assert.equal(formatDeactivateConfirmTitle(1), 'Deaktivere brukeren?');
assert.equal(formatDeactivateConfirmTitle(3), 'Deaktivere 3 brukere?');

assert.equal(adminEmailsMatchForConfirm('  Test@Mail.NO ', 'test@mail.no'), true);
assert.equal(adminEmailsMatchForConfirm('wrong', 'test@mail.no'), false);
assert.equal(adminEmailsMatchForConfirm('', 'test@mail.no'), false);

console.log('lib/admin/users/ux-helpers.test.ts: ok');
