import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserNameFields } from '@/lib/identity/public-identity';

export type PublicUserDisplayRow = UserNameFields & { user_id: string };

type DisplayRpcRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
};

/**
 * Resolve author display fields without SELECT on public.users (RLS-safe).
 */
export async function loadPublicUserDisplays(
  client: Pick<SupabaseClient, 'rpc'>,
  userIds: string[],
): Promise<Map<string, UserNameFields>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, UserNameFields>();
  if (unique.length === 0) {
    return map;
  }

  const { data, error } = await client.rpc('get_public_user_displays', {
    p_user_ids: unique,
  });

  if (error) {
    console.error('get_public_user_displays error:', error.message);
    return map;
  }

  for (const row of (data ?? []) as DisplayRpcRow[]) {
    if (!row?.user_id) continue;
    map.set(row.user_id, {
      first_name: row.first_name,
      last_name: row.last_name,
      name: row.name,
    });
  }

  return map;
}
