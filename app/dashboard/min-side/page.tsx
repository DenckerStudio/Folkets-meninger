import { redirect } from 'next/navigation';
import { MinSideOverviewPanel } from '@/components/min-side/min-side-overview-panel';
import { isAdmin } from '@/lib/admin/gate';
import { listUserBadges } from '@/lib/knowledge/service';
import { loadMinSideOverview } from '@/lib/min-side/overview';
import { legacyMinSideRedirectFromSearchParams } from '@/lib/min-side/sections';
import { getUserPointsProfile } from '@/lib/user-points-profile';
import { getServerSupabase } from '@/lib/supabase-server';
import { readUserSubscription } from '@/lib/stemme-plus/service';
import { isStemmePlusActive } from '@/lib/stemme-plus/tier';
import type { UserPointsProgress } from '@/lib/user-points-levels';
import type { EarnedBadge } from '@/lib/knowledge/types';

export default async function MinSideOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const legacyRedirect = legacyMinSideRedirectFromSearchParams(params);
  if (legacyRedirect) {
    redirect(legacyRedirect);
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const viewerIsAdmin = await isAdmin(user.id, user.email);

  let snapshot: Awaited<ReturnType<typeof loadMinSideOverview>> | null = null;
  let points = 0;
  let pointsProgress: UserPointsProgress | null = null;
  let badges: EarnedBadge[] = [];
  let isStemmePlus = false;

  try {
    snapshot = await loadMinSideOverview(user.id);
  } catch {
    snapshot = null;
  }

  try {
    const [pointsProfile, badgeList, subscription] = await Promise.all([
      getUserPointsProfile(user.id),
      listUserBadges(user.id),
      readUserSubscription(supabase, user.id),
    ]);
    points = pointsProfile.points;
    pointsProgress = pointsProfile.progress;
    badges = badgeList;
    isStemmePlus = isStemmePlusActive(subscription);
  } catch {
    // Identity block still renders with defaults.
  }

  return (
    <MinSideOverviewPanel
      user={user}
      snapshot={snapshot}
      points={points}
      pointsProgress={pointsProgress}
      badges={badges}
      isStemmePlus={isStemmePlus}
      showAdminLink={viewerIsAdmin}
    />
  );
}