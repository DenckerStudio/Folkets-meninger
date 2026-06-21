import { USER_POINT_TIERS } from '@/lib/user-points-levels';

export const SOURCE_SUGGEST_VETERAN_POINTS = USER_POINT_TIERS.find((tier) => tier.id === 'veteran')!.minPoints;
export const SOURCE_SUGGEST_MONTHLY_LIMIT = 3;

export type SourceSuggestionAccess = {
  canSuggest: boolean;
  points: number;
  pointsNeeded: number;
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
};

export function getSourceSuggestionAccess(points: number, monthlyUsed = 0): SourceSuggestionAccess {
  const safePoints = Math.max(0, Math.floor(points));
  const safeMonthlyUsed = Math.max(0, Math.floor(monthlyUsed));

  if (safePoints < SOURCE_SUGGEST_VETERAN_POINTS) {
    return {
      canSuggest: false,
      points: safePoints,
      pointsNeeded: SOURCE_SUGGEST_VETERAN_POINTS - safePoints,
      monthlyLimit: 0,
      monthlyUsed: safeMonthlyUsed,
      monthlyRemaining: 0,
    };
  }

  return {
    canSuggest: safeMonthlyUsed < SOURCE_SUGGEST_MONTHLY_LIMIT,
    points: safePoints,
    pointsNeeded: 0,
    monthlyLimit: SOURCE_SUGGEST_MONTHLY_LIMIT,
    monthlyUsed: safeMonthlyUsed,
    monthlyRemaining: Math.max(0, SOURCE_SUGGEST_MONTHLY_LIMIT - safeMonthlyUsed),
  };
}
