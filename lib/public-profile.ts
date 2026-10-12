import type { SupabaseClient } from '@supabase/supabase-js';
import { getAnonSupabase, getServiceSupabase } from '@/lib/supabase';
import { parseActivityVisibility, type ActivityVisibility } from '@/lib/identity/activity-visibility';
import { listUserBadges } from '@/lib/knowledge/service';
import type { EarnedBadge } from '@/lib/knowledge/types';
import { isStemmePlusActive } from '@/lib/stemme-plus/tier';

export type PublicProfile = {
  id: string;
  displayName: string;
  initials: string;
  isPublic: boolean;
  bio: string | null;
  partyPreference: string | null;
  activityVisibility: ActivityVisibility;
  /** Aggregate activity counts — only when visibility allows. Never vote choices. */
  stats: {
    votesCast: number | null;
    hearingComments: number | null;
  };
  badges: EarnedBadge[];
  isStemmePlusSupporter: boolean;
};

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const service = getServiceSupabase();
  let { data: user, error: userError } = await service
    .from('users')
    .select(
      'id, first_name, last_name, name, bio, party_preference, profile_is_public, show_party_preference, activity_visibility, subscription_tier, subscription_status, subscription_period_end',
    )
    .eq('id', userId)
    .maybeSingle();

  if (userError) {
    const fallback = await service
      .from('users')
      .select('id, first_name, last_name, name, bio, party_preference, profile_is_public, show_party_preference')
      .eq('id', userId)
      .maybeSingle();
    user = fallback.data
      ? {
          ...fallback.data,
          activity_visibility: 'private',
          subscription_tier: 'free',
          subscription_status: null,
          subscription_period_end: null,
        }
      : null;
  }

  if (!user) return null;

  const displayName =
    user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`.trim()
      : user.name || 'Bruker';

  const activityVisibility = parseActivityVisibility(
    (user as { activity_visibility?: unknown }).activity_visibility,
  );
  const shareActivity = activityVisibility === 'summary' || activityVisibility === 'full';

  let votesCast: number | null = null;
  let hearingComments: number | null = null;

  if (shareActivity) {
    const [votesRes, hearingsRes] = await Promise.all([
      service.from('user_vote_receipts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      service
        .from('hearing_comments')
        .select('id', { count: 'exact', head: true })
        .eq('author_user_id', userId),
    ]);
    votesCast = votesRes.count ?? 0;
    hearingComments = hearingsRes.error ? 0 : (hearingsRes.count ?? 0);
  }

  return {
    id: user.id,
    displayName,
    initials: initialsFromName(displayName),
    isPublic: user.profile_is_public === true,
    bio: user.profile_is_public ? user.bio ?? null : null,
    partyPreference:
      user.profile_is_public && user.show_party_preference ? user.party_preference ?? null : null,
    activityVisibility,
    stats: {
      votesCast,
      hearingComments,
    },
    badges: shareActivity ? await listUserBadges(userId) : [],
    isStemmePlusSupporter: isStemmePlusActive(user),
  };
}

export type PublicProfilePreview = {
  userId: string | null;
  displayName: string | null;
  initials: string | null;
  isStemmePlusSupporter: boolean;
};

const PUBLIC_DISPLAY_COLUMNS = 'id, first_name, last_name, name';
const OWN_SUBSCRIPTION_COLUMNS = 'subscription_tier, subscription_status, subscription_period_end';

function publicSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/**
 * Public display fields for the signed-in user's own profile, read through the
 * request session (or the anon key). Only column-level granted fields are
 * selected (`id, first_name, last_name, name` for everyone; subscription
 * columns for the owner via `users_select_own_subscription`). Never the service
 * role, so one user can never read another user's private profile fields.
 */
export async function getOwnPublicProfilePreview(
  client: Pick<SupabaseClient, 'from'> | null | undefined,
  userId: string | null | undefined,
): Promise<PublicProfilePreview> {
  if (!userId) {
    return { userId: null, displayName: null, initials: null, isStemmePlusSupporter: false };
  }

  const usable = client ?? (publicSupabaseConfigured() ? getAnonSupabase() : null);
  if (!usable) {
    return { userId, displayName: null, initials: null, isStemmePlusSupporter: false };
  }

  const withSubscription = await usable
    .from('users')
    .select(`${PUBLIC_DISPLAY_COLUMNS}, ${OWN_SUBSCRIPTION_COLUMNS}`)
    .eq('id', userId)
    .maybeSingle();

  let row: Record<string, unknown> | null = null;

  if (!withSubscription.error) {
    row = (withSubscription.data as Record<string, unknown> | null) ?? null;
  } else {
    const publicOnly = await usable
      .from('users')
      .select(PUBLIC_DISPLAY_COLUMNS)
      .eq('id', userId)
      .maybeSingle();
    row = publicOnly.error ? null : ((publicOnly.data as Record<string, unknown> | null) ?? null);
  }

  if (!row) {
    return { userId, displayName: null, initials: null, isStemmePlusSupporter: false };
  }

  const displayName =
    typeof row.first_name === 'string' && typeof row.last_name === 'string' && row.first_name && row.last_name
      ? `${row.first_name} ${row.last_name}`.trim()
      : typeof row.name === 'string' && row.name
        ? row.name
        : null;

  return {
    userId,
    displayName,
    initials: displayName ? initialsFromName(displayName) : null,
    isStemmePlusSupporter: isStemmePlusActive(row),
  };
}
