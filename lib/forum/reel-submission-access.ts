import { USER_POINT_TIERS } from '@/lib/user-points-levels';

export const REEL_SUBMIT_TRUSTED_POINTS = USER_POINT_TIERS.find((tier) => tier.id === 'trusted')!.minPoints;
export const REEL_SUBMIT_CURATOR_POINTS = USER_POINT_TIERS.find((tier) => tier.id === 'curator')!.minPoints;

export const REEL_SUBMIT_WEEKLY_LIMIT_TRUSTED = 2;
export const REEL_SUBMIT_WEEKLY_LIMIT_CURATOR = 5;

export type ReelSubmissionMode = 'locked' | 'trusted' | 'curator';

export type ReelSubmissionAccess = {
  canSubmit: boolean;
  mode: ReelSubmissionMode;
  points: number;
  pointsNeeded: number;
  weeklyLimit: number;
  weeklyUsed: number;
  weeklyRemaining: number;
  publishesWithoutAdmin: boolean;
};

export function getReelSubmissionAccess(
  points: number,
  weeklyUsed = 0,
): ReelSubmissionAccess {
  const safePoints = Math.max(0, Math.floor(points));
  const safeWeeklyUsed = Math.max(0, Math.floor(weeklyUsed));

  if (safePoints < REEL_SUBMIT_TRUSTED_POINTS) {
    return {
      canSubmit: false,
      mode: 'locked',
      points: safePoints,
      pointsNeeded: REEL_SUBMIT_TRUSTED_POINTS - safePoints,
      weeklyLimit: 0,
      weeklyUsed: safeWeeklyUsed,
      weeklyRemaining: 0,
      publishesWithoutAdmin: false,
    };
  }

  const isCurator = safePoints >= REEL_SUBMIT_CURATOR_POINTS;
  const weeklyLimit = isCurator ? REEL_SUBMIT_WEEKLY_LIMIT_CURATOR : REEL_SUBMIT_WEEKLY_LIMIT_TRUSTED;

  return {
    canSubmit: safeWeeklyUsed < weeklyLimit,
    mode: isCurator ? 'curator' : 'trusted',
    points: safePoints,
    pointsNeeded: 0,
    weeklyLimit,
    weeklyUsed: safeWeeklyUsed,
    weeklyRemaining: Math.max(0, weeklyLimit - safeWeeklyUsed),
    publishesWithoutAdmin: isCurator,
  };
}
