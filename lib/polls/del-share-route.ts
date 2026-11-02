import { isAdmin } from '@/lib/admin/gate';
import { isSharePollsEnabled } from '@/lib/polls/share-flag';
import { getServerSupabase } from '@/lib/supabase-server';

export type PublicSharePollRouteAccess = {
  sharePollsEnabled: boolean;
  isAdminUser: boolean;
};

/** Same gate as `/del/[id]` and `/embed/[id]` page bodies. */
export function isPublicSharePollRouteEnabled({
  sharePollsEnabled,
  isAdminUser,
}: PublicSharePollRouteAccess): boolean {
  return sharePollsEnabled || isAdminUser;
}

export async function resolvePublicSharePollRouteAccess(): Promise<PublicSharePollRouteAccess> {
  const sharePollsEnabled = isSharePollsEnabled();
  if (sharePollsEnabled) {
    return { sharePollsEnabled: true, isAdminUser: false };
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { sharePollsEnabled: false, isAdminUser: false };
  }

  const isAdminUser = await isAdmin(user.id, user.email);
  return { sharePollsEnabled: false, isAdminUser };
}

export async function isPublicSharePollRouteEnabledForRequest(): Promise<boolean> {
  const access = await resolvePublicSharePollRouteAccess();
  return isPublicSharePollRouteEnabled(access);
}
