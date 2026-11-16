import { getServiceSupabase } from '@/lib/supabase';
import { readUserSubscription } from '@/lib/stemme-plus/service';
import {
  evaluateLastAdminDeleteBlock,
  evaluateStemmePlusDeleteBlock,
  mergeDeleteEligibility,
  type SelfDeleteEligibility,
} from '@/lib/account-delete/eligibility';
import {
  SELF_DELETE_LAST_ADMIN_BLOCK_MESSAGE,
  SELF_DELETE_MISSING_MIGRATION_MESSAGE,
  SELF_DELETE_RPC_FAILED_MESSAGE,
} from '@/lib/account-delete/constants';

export type AccountDeleteBlockReason = 'stemme_plus' | 'last_admin' | 'missing_migration';

export class AccountDeleteBlockedError extends Error {
  constructor(
    message: string,
    readonly reason: AccountDeleteBlockReason,
  ) {
    super(message);
    this.name = 'AccountDeleteBlockedError';
  }
}

export type AccountDeleteResult = 'complete' | 'auth_pending';

function isMissingDeleteRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202') return true;
  return /delete_my_account/i.test(error.message ?? '');
}

function mapDeleteRpcError(message: string): Error {
  const lower = message.toLowerCase();
  if (lower.includes('last admin')) {
    return new AccountDeleteBlockedError(SELF_DELETE_LAST_ADMIN_BLOCK_MESSAGE, 'last_admin');
  }
  if (lower.includes('user not found')) {
    return new Error('Bruker ikke funnet');
  }
  return new Error(SELF_DELETE_RPC_FAILED_MESSAGE);
}

async function isOnlyAppAdmin(userId: string): Promise<boolean> {
  const service = getServiceSupabase();
  const { data: roleRow, error: roleError } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (roleError) {
    throw roleError;
  }
  if (!roleRow) {
    return false;
  }
  const { count, error: countError } = await service
    .from('user_roles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin');
  if (countError) {
    throw countError;
  }
  return (count ?? 0) === 1;
}

export async function getSelfDeleteEligibility(userId: string): Promise<SelfDeleteEligibility> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { allowed: true };
  }

  const service = getServiceSupabase();
  const subscription = await readUserSubscription(service, userId);
  const onlyAdmin = await isOnlyAppAdmin(userId);

  return mergeDeleteEligibility([
    evaluateStemmePlusDeleteBlock(subscription),
    evaluateLastAdminDeleteBlock(onlyAdmin),
  ]);
}

export async function assertSelfDeleteAllowed(userId: string): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Ikke konfigurert');
  }

  const eligibility = await getSelfDeleteEligibility(userId);
  if (!eligibility.allowed && eligibility.reason && eligibility.message) {
    throw new AccountDeleteBlockedError(eligibility.message, eligibility.reason);
  }
}

export async function purgeAccountData(userId: string): Promise<void> {
  const service = getServiceSupabase();
  const { error } = await service.rpc('delete_my_account', { p_user_id: userId });
  if (error) {
    if (isMissingDeleteRpc(error)) {
      throw new AccountDeleteBlockedError(SELF_DELETE_MISSING_MIGRATION_MESSAGE, 'missing_migration');
    }
    throw mapDeleteRpcError(error.message ?? '');
  }
}

export async function deleteAuthUser(userId: string): Promise<void> {
  const service = getServiceSupabase();
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) {
    throw error;
  }
}

export async function deleteOwnAccount(userId: string): Promise<AccountDeleteResult> {
  await assertSelfDeleteAllowed(userId);
  await purgeAccountData(userId);
  try {
    await deleteAuthUser(userId);
    return 'complete';
  } catch (err) {
    console.error('delete-account auth.admin.deleteUser failed', err);
    return 'auth_pending';
  }
}