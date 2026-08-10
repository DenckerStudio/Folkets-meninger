import type { User } from '@supabase/supabase-js';
import { userHasPublicIdentity, type UserNameFields } from '@/lib/identity/public-identity';

export function namesFromAuthUser(user: User): { firstName: string; lastName: string } | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const firstName =
    typeof meta?.first_name === 'string' ? meta.first_name.trim() : '';
  const lastName =
    typeof meta?.last_name === 'string' ? meta.last_name.trim() : '';

  if (firstName && lastName) {
    return { firstName, lastName };
  }

  const full =
    typeof meta?.full_name === 'string'
      ? meta.full_name.trim()
      : typeof meta?.name === 'string'
        ? meta.name.trim()
        : '';

  if (!full) return null;

  const space = full.indexOf(' ');
  if (space <= 0) return null;

  return {
    firstName: full.slice(0, space).trim(),
    lastName: full.slice(space + 1).trim(),
  };
}

export function authUserHasPublicIdentity(user: User): boolean {
  const names = namesFromAuthUser(user);
  if (!names) return false;
  const fields: UserNameFields = {
    first_name: names.firstName,
    last_name: names.lastName,
  };
  return userHasPublicIdentity(fields);
}

/** @deprecated Use authUserHasPublicIdentity */
export const authUserHasForumIdentity = authUserHasPublicIdentity;
