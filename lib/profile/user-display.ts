import type { User } from '@supabase/supabase-js';

export function getProfileAvatarUrl(user: User): string | null {
  const meta = user.user_metadata;
  if (!meta || typeof meta !== 'object') return null;
  const avatar =
    (meta as { avatar_url?: unknown }).avatar_url ??
    (meta as { picture?: unknown }).picture;
  return typeof avatar === 'string' && avatar.trim().length > 0 ? avatar.trim() : null;
}

export function getProfileDisplayName(user: User): string | null {
  const meta = user.user_metadata;
  const first = typeof meta?.first_name === 'string' ? meta.first_name.trim() : '';
  const last = typeof meta?.last_name === 'string' ? meta.last_name.trim() : '';
  if (first && last) return `${first} ${last}`;
  const full = typeof meta?.full_name === 'string' ? meta.full_name.trim() : '';
  if (full) return full;
  return null;
}

export function getProfileInitials(user: User): string {
  const name = getProfileDisplayName(user);
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const email = user.email ?? '';
  return email.slice(0, 2).toUpperCase() || '?';
}
