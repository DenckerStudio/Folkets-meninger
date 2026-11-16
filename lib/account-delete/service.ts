import { getServiceSupabase } from '@/lib/supabase';
import { readUserSubscription } from '@/lib/stemme-plus/service';
import { isStemmePlusActive } from '@/lib/stemme-plus/tier';
import {
  SELF_DELETE_LAST_ADMIN_BLOCK_MESSAGE,
  SELF_DELETE_MISSING_MIGRATION_MESSAGE,
  SELF_DELETE_STEMME_PLUS_BLOCK_MESSAGE,
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
  return new Error('Kunne ikke slette kontoen');
}

export async function assertSelfDeleteAllowed(userId: string): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Ikke konfigurert');
  }

  const service = getServiceSupabase();
  const subscription = await readUserSubscription(service, userId);
  if (isStemmePlusActive(subscription)) {
    throw new AccountDeleteBlockedError(SELF_DELETE_STEMME_PLUS_BLOCK_MESSAGE, 'stemme_plus');
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
    throw new Error('Kunne ikke fullføre sletting av innlogging');
  }
}

export async function deleteOwnAccount(userId: string): Promise<void> {
  await assertSelfDeleteAllowed(userId);
  await purgeAccountData(userId);
  await deleteAuthUser(userId);
}