'use client';

import type { User } from '@supabase/supabase-js';
import { ProfileHero } from '@/components/profile/profile-hero';
import type { EarnedBadge } from '@/lib/knowledge/types';
import type { UserPointsProgress } from '@/lib/user-points-levels';

type MinSideOverviewIdentityProps = {
  user: User;
  points: number;
  pointsProgress: UserPointsProgress | null;
  badges: EarnedBadge[];
  isStemmePlus: boolean;
};

export function MinSideOverviewIdentity({
  user,
  points,
  pointsProgress,
  badges,
  isStemmePlus,
}: MinSideOverviewIdentityProps) {
  return (
    <ProfileHero
      user={user}
      points={points}
      pointsProgress={pointsProgress}
      badges={badges}
      isStemmePlus={isStemmePlus}
      variant="compact"
    />
  );
}