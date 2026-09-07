import type { User } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';
import { namesFromAuthUser } from '@/lib/user-identity';

export type FiderUserProfile = {
  sub: string;
  name: string;
  email: string;
};

type PublicUserRow = {
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
};

function displayNameFromRow(row: PublicUserRow, authUser: User): string {
  const first = row.first_name?.trim() ?? '';
  const last = row.last_name?.trim() ?? '';
  if (first && last) return `${first} ${last}`;

  const stored = row.name?.trim();
  if (stored) return stored;

  const names = namesFromAuthUser(authUser);
  if (names) return `${names.firstName} ${names.lastName}`;

  const meta = authUser.user_metadata as Record<string, unknown> | undefined;
  const fullName =
    typeof meta?.full_name === 'string'
      ? meta.full_name.trim()
      : typeof meta?.name === 'string'
        ? meta.name.trim()
        : '';

  if (fullName) return fullName;

  const email = authUser.email?.trim();
  if (email) return email.split('@')[0] ?? 'Bruker';

  return 'Bruker';
}

export async function resolveFiderUserProfile(authUser: User): Promise<FiderUserProfile> {
  const service = getServiceSupabase();
  const { data } = await service
    .from('users')
    .select('first_name, last_name, name, email')
    .eq('id', authUser.id)
    .maybeSingle();

  const row = (data ?? {}) as PublicUserRow;
  const email = (row.email?.trim() || authUser.email?.trim() || '').toLowerCase();

  return {
    sub: authUser.id,
    name: displayNameFromRow(row, authUser),
    email,
  };
}
