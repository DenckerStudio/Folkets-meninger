import type { User } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';
import { namesFromAuthUser } from '@/lib/user-identity';

/**
 * Ensures a row exists in public.users for the Supabase Auth user.
 * Forum/hearing tables reference public.users, not auth.users directly.
 */
export async function ensurePublicUser(user: User): Promise<void> {
  const service = getServiceSupabase();
  const names = namesFromAuthUser(user);
  const meta = user.user_metadata as Record<string, unknown> | undefined;

  const { error: rpcError } = await service.rpc('ensure_public_user', {
    p_user_id: user.id,
  });

  if (!rpcError) {
    if (names) {
      const { error: nameError } = await service.rpc('update_user_profile_names', {
        p_user_id: user.id,
        p_first_name: names.firstName,
        p_last_name: names.lastName,
      });
      if (nameError) {
        console.warn('update_user_profile_names skipped', nameError.message);
      }
    }
    return;
  }

  const fullName =
    typeof meta?.full_name === 'string'
      ? meta.full_name.trim()
      : names
        ? `${names.firstName} ${names.lastName}`
        : null;

  const { error: upsertError } = await service.from('users').upsert(
    {
      id: user.id,
      first_name: names?.firstName ?? null,
      last_name: names?.lastName ?? null,
      name: fullName,
      email: user.email ?? null,
    },
    { onConflict: 'id' },
  );

  if (upsertError) {
    console.error('ensurePublicUser failed', { rpcError, upsertError });
    throw upsertError;
  }
}
