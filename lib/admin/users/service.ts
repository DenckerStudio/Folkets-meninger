import { getServiceSupabase } from '@/lib/supabase';
import { isStripeSubscriptionEntitled } from '@/lib/stripe/subscription';
import type { AdminBulkItemResult, AdminUserListResult, AdminUserRow } from '@/lib/admin/users/types';
import type { AdminUserBulkBody, AdminUserListQuery, AdminUserPatchBody } from '@/lib/admin/users/schemas';

export class AdminUsersServiceError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'conflict' | 'misconfigured' | 'invalid',
  ) {
    super(message);
    this.name = 'AdminUsersServiceError';
  }
}

function requireServiceRole(): void {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AdminUsersServiceError('Serveren er ikke konfigurert', 'misconfigured');
  }
}

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202') return true;
  return /admin_list_users|admin_anonymize_user|admin_assert_user_mutation_allowed/i.test(
    error.message ?? '',
  );
}

function mapRpcError(error: { message?: string }): AdminUsersServiceError {
  const message = error.message ?? '';
  const lower = message.toLowerCase();
  if (lower.includes('cannot modify self')) {
    return new AdminUsersServiceError('Du kan ikke endre din egen konto', 'conflict');
  }
  if (lower.includes('last admin') || lower.includes('siste administrator')) {
    return new AdminUsersServiceError('Kan ikke fjerne siste administrator', 'conflict');
  }
  if (lower.includes('not found') || lower.includes('user not found')) {
    return new AdminUsersServiceError('Bruker ikke funnet', 'not_found');
  }
  if (lower.includes('invalid')) {
    return new AdminUsersServiceError('Ugyldig forespørsel', 'invalid');
  }
  return new AdminUsersServiceError('Operasjonen feilet', 'invalid');
}

function parseUserRow(raw: Record<string, unknown>): AdminUserRow | null {
  if (typeof raw.user_id !== 'string') return null;
  return {
    userId: raw.user_id,
    email: typeof raw.email === 'string' ? raw.email : null,
    firstName: typeof raw.first_name === 'string' ? raw.first_name : null,
    lastName: typeof raw.last_name === 'string' ? raw.last_name : null,
    displayName: typeof raw.display_name === 'string' ? raw.display_name : null,
    isAdmin: raw.is_admin === true,
    subscriptionTier: typeof raw.subscription_tier === 'string' ? raw.subscription_tier : 'free',
    subscriptionStatus: typeof raw.subscription_status === 'string' ? raw.subscription_status : null,
    subscriptionPeriodEnd:
      typeof raw.subscription_period_end === 'string' ? raw.subscription_period_end : null,
    isDeactivated: raw.is_deactivated === true,
    createdAt: typeof raw.created_at === 'string' ? raw.created_at : null,
    lastSignInAt: typeof raw.last_sign_in_at === 'string' ? raw.last_sign_in_at : null,
  };
}

export async function listAdminUsers(
  adminUserId: string,
  query: AdminUserListQuery,
): Promise<AdminUserListResult> {
  requireServiceRole();
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('admin_list_users', {
    p_admin_user_id: adminUserId,
    p_query: query.q ?? null,
    p_role_filter: query.role ?? 'all',
    p_tier_filter: query.tier ?? 'all',
    p_status_filter: query.status ?? 'all',
    p_sort: query.sort ?? 'created_at',
    p_sort_dir: query.order ?? 'desc',
    p_page: query.page ?? 1,
    p_page_size: query.pageSize ?? 25,
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw new AdminUsersServiceError(
        'Brukeradmin er ikke tilgjengelig ennå (database-migrasjon mangler)',
        'misconfigured',
      );
    }
    throw mapRpcError(error);
  }

  if (!data || typeof data !== 'object') {
    return { page: 1, pageSize: query.pageSize ?? 25, total: 0, users: [] };
  }

  const payload = data as Record<string, unknown>;
  const usersRaw = Array.isArray(payload.users) ? payload.users : [];
  const users = usersRaw
    .map((row) => (row && typeof row === 'object' ? parseUserRow(row as Record<string, unknown>) : null))
    .filter((row): row is AdminUserRow => row != null);

  return {
    page: typeof payload.page === 'number' ? payload.page : query.page ?? 1,
    pageSize: typeof payload.page_size === 'number' ? payload.page_size : query.pageSize ?? 25,
    total: typeof payload.total === 'number' ? payload.total : users.length,
    users,
  };
}

export async function getAdminUserById(
  adminUserId: string,
  targetUserId: string,
): Promise<AdminUserRow | null> {
  requireServiceRole();
  void adminUserId;
  const service = getServiceSupabase();
  const { data: authData, error: authError } = await service.auth.admin.getUserById(targetUserId);
  if (authError || !authData.user) {
    return null;
  }

  const authUser = authData.user;
  const { data: profile } = await service
    .from('users')
    .select(
      'first_name, last_name, name, subscription_tier, subscription_status, subscription_period_end',
    )
    .eq('id', targetUserId)
    .maybeSingle();

  const { data: roleRow } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', targetUserId)
    .eq('role', 'admin')
    .maybeSingle();

  const bannedUntil = authUser.banned_until ? new Date(authUser.banned_until) : null;
  const isDeactivated = Boolean(bannedUntil && bannedUntil.getTime() > Date.now());

  return {
    userId: authUser.id,
    email: authUser.email ?? null,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    displayName: profile?.name ?? null,
    isAdmin: Boolean(roleRow),
    subscriptionTier: profile?.subscription_tier ?? 'free',
    subscriptionStatus: profile?.subscription_status ?? null,
    subscriptionPeriodEnd: profile?.subscription_period_end ?? null,
    isDeactivated,
    createdAt: authUser.created_at ?? null,
    lastSignInAt: authUser.last_sign_in_at ?? null,
  };
}

async function assertMutationAllowed(
  adminUserId: string,
  targetUserId: string,
  options: { preventSelf: boolean; preventLastAdmin: boolean },
): Promise<void> {
  const service = getServiceSupabase();
  const { error } = await service.rpc('admin_assert_user_mutation_allowed', {
    p_admin_user_id: adminUserId,
    p_target_user_id: targetUserId,
    p_prevent_self: options.preventSelf,
    p_prevent_last_admin: options.preventLastAdmin,
  });
  if (error) {
    if (isMissingRpc(error)) {
      throw new AdminUsersServiceError(
        'Brukeradmin er ikke tilgjengelig ennå (database-migrasjon mangler)',
        'misconfigured',
      );
    }
    throw mapRpcError(error);
  }
}

async function writeAudit(
  adminUserId: string,
  action: string,
  targetUserId: string,
  meta: Record<string, string | boolean | number> = {},
): Promise<void> {
  const service = getServiceSupabase();
  await service.rpc('admin_write_audit_log', {
    p_actor_id: adminUserId,
    p_action: action,
    p_target_user_id: targetUserId,
    p_meta: meta,
  });
}

async function banUser(targetUserId: string): Promise<void> {
  const service = getServiceSupabase();
  const { error } = await service.auth.admin.updateUserById(targetUserId, {
    ban_duration: '876000h',
  });
  if (error) throw error;
}

async function unbanUser(targetUserId: string): Promise<void> {
  const service = getServiceSupabase();
  const { error } = await service.auth.admin.updateUserById(targetUserId, {
    ban_duration: 'none',
  });
  if (error) throw error;
}

async function anonymizeUser(adminUserId: string, targetUserId: string): Promise<void> {
  const service = getServiceSupabase();
  const { error } = await service.rpc('admin_anonymize_user', {
    p_admin_user_id: adminUserId,
    p_target_user_id: targetUserId,
  });
  if (error) {
    if (isMissingRpc(error)) {
      throw new AdminUsersServiceError(
        'Brukeradmin er ikke tilgjengelig ennå (database-migrasjon mangler)',
        'misconfigured',
      );
    }
    throw mapRpcError(error);
  }
}

export async function assertHardDeleteAllowed(targetUserId: string): Promise<void> {
  requireServiceRole();
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('users')
    .select('subscription_status')
    .eq('id', targetUserId)
    .maybeSingle();
  if (error) throw error;
  if (isStripeSubscriptionEntitled(data?.subscription_status)) {
    throw new AdminUsersServiceError(
      'Brukeren har et aktivt Stemme+-abonnement i Stripe. Avslutt abonnementet før permanent sletting.',
      'conflict',
    );
  }
}

export async function deactivateAdminUser(
  adminUserId: string,
  targetUserId: string,
): Promise<void> {
  requireServiceRole();
  await assertMutationAllowed(adminUserId, targetUserId, {
    preventSelf: true,
    preventLastAdmin: true,
  });
  await banUser(targetUserId);
  await anonymizeUser(adminUserId, targetUserId);
  await writeAudit(adminUserId, 'deactivate_user', targetUserId);
}

export async function reactivateAdminUser(
  adminUserId: string,
  targetUserId: string,
): Promise<void> {
  requireServiceRole();
  await assertMutationAllowed(adminUserId, targetUserId, {
    preventSelf: false,
    preventLastAdmin: false,
  });
  await unbanUser(targetUserId);
  await writeAudit(adminUserId, 'reactivate_user', targetUserId);
}

export async function hardDeleteAdminUser(
  adminUserId: string,
  targetUserId: string,
  confirmEmail: string,
): Promise<void> {
  requireServiceRole();
  await assertMutationAllowed(adminUserId, targetUserId, {
    preventSelf: true,
    preventLastAdmin: true,
  });
  await assertHardDeleteAllowed(targetUserId);

  const service = getServiceSupabase();
  const { data: authUser, error: authError } = await service.auth.admin.getUserById(targetUserId);
  if (authError) throw authError;
  const email = authUser.user?.email?.trim().toLowerCase() ?? '';
  if (!email || email !== confirmEmail.trim().toLowerCase()) {
    throw new AdminUsersServiceError('E-post stemmer ikke', 'invalid');
  }

  const { error } = await service.auth.admin.deleteUser(targetUserId);
  if (error) throw error;
  await writeAudit(adminUserId, 'hard_delete_user', targetUserId);
}

export async function patchAdminUser(
  adminUserId: string,
  targetUserId: string,
  body: AdminUserPatchBody,
): Promise<void> {
  requireServiceRole();
  const service = getServiceSupabase();

  if (body.reactivate) {
    await reactivateAdminUser(adminUserId, targetUserId);
  }

  if (typeof body.isAdmin === 'boolean') {
    await assertMutationAllowed(adminUserId, targetUserId, {
      preventSelf: true,
      preventLastAdmin: !body.isAdmin,
    });
    if (body.isAdmin) {
      const { error } = await service.rpc('grant_app_role', {
        p_user_id: targetUserId,
        p_role: 'admin',
        p_granted_by: adminUserId,
      });
      if (error) throw mapRpcError(error);
      await writeAudit(adminUserId, 'grant_admin', targetUserId);
    } else {
      const { error } = await service.rpc('revoke_app_role', {
        p_user_id: targetUserId,
        p_role: 'admin',
        p_revoked_by: adminUserId,
      });
      if (error) throw mapRpcError(error);
      await writeAudit(adminUserId, 'revoke_admin', targetUserId);
    }
  }

  if (body.subscriptionTier === 'stemme_plus') {
    await assertMutationAllowed(adminUserId, targetUserId, {
      preventSelf: false,
      preventLastAdmin: false,
    });
    const { error } = await service.rpc('grant_stemme_plus', {
      p_user_id: targetUserId,
      p_granted_by: adminUserId,
    });
    if (error) throw mapRpcError(error);
    await writeAudit(adminUserId, 'grant_stemme_plus', targetUserId);
  } else if (body.subscriptionTier === 'free') {
    await assertMutationAllowed(adminUserId, targetUserId, {
      preventSelf: false,
      preventLastAdmin: false,
    });
    const { error } = await service.rpc('revoke_stemme_plus', {
      p_user_id: targetUserId,
      p_revoked_by: adminUserId,
    });
    if (error) throw mapRpcError(error);
    await writeAudit(adminUserId, 'revoke_stemme_plus', targetUserId);
  }
}

function bulkSkip(
  userId: string,
  reason: AdminBulkItemResult['reason'],
  message: string,
): AdminBulkItemResult {
  return { userId, ok: false, reason, message };
}

export async function bulkAdminUsersAction(
  adminUserId: string,
  body: AdminUserBulkBody,
): Promise<{ results: AdminBulkItemResult[] }> {
  requireServiceRole();
  const results: AdminBulkItemResult[] = [];

  for (const userId of body.userIds) {
    try {
      if (adminUserId === userId && (body.action === 'deactivate' || body.action === 'revoke_admin')) {
        results.push(
          bulkSkip(userId, 'self', 'Du kan ikke endre din egen konto'),
        );
        continue;
      }

      if (body.action === 'set_admin') {
        await patchAdminUser(adminUserId, userId, { isAdmin: true });
      } else if (body.action === 'revoke_admin') {
        await patchAdminUser(adminUserId, userId, { isAdmin: false });
      } else if (body.action === 'grant_stemme_plus') {
        await patchAdminUser(adminUserId, userId, { subscriptionTier: 'stemme_plus' });
      } else if (body.action === 'revoke_stemme_plus') {
        await patchAdminUser(adminUserId, userId, { subscriptionTier: 'free' });
      } else if (body.action === 'deactivate') {
        await deactivateAdminUser(adminUserId, userId);
      } else if (body.action === 'reactivate') {
        await reactivateAdminUser(adminUserId, userId);
      } else {
        results.push(bulkSkip(userId, 'invalid', 'Ugyldig handling'));
        continue;
      }
      results.push({ userId, ok: true });
    } catch (error) {
      if (error instanceof AdminUsersServiceError) {
        const reason =
          error.code === 'conflict' && error.message.includes('egen')
            ? 'self'
            : error.code === 'conflict' && error.message.includes('siste')
              ? 'last_admin'
              : error.code === 'not_found'
                ? 'not_found'
                : 'invalid';
        results.push({ userId, ok: false, reason, message: error.message });
        continue;
      }
      results.push({ userId, ok: false, reason: 'invalid', message: 'Operasjonen feilet' });
    }
  }

  return { results };
}

export function serviceErrorStatus(error: AdminUsersServiceError): number {
  switch (error.code) {
    case 'misconfigured':
      return 503;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    case 'invalid':
    default:
      return 400;
  }
}
