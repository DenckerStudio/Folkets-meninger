export type UserPointTierId = 'new' | 'active' | 'trusted' | 'curator' | 'veteran';

export type UserPointTier = {
  id: UserPointTierId;
  name: string;
  minPoints: number;
  color: string;
  barColor: string;
  ringColor: string;
  unlocks: string;
};

export const USER_POINT_TIERS: readonly UserPointTier[] = [
  {
    id: 'new',
    name: 'Ny deltaker',
    minPoints: 0,
    color: 'text-foreground',
    barColor: 'bg-muted-foreground/50',
    ringColor: 'ring-border',
    unlocks: 'Les saksdokumenter og ta kunnskapstesten.',
  },
  {
    id: 'active',
    name: 'Informert',
    minPoints: 25,
    color: 'text-sky-700 dark:text-sky-300',
    barColor: 'bg-sky-500',
    ringColor: 'ring-sky-200',
    unlocks: 'Nivå «Informert» etter lesing og tester.',
  },
  {
    id: 'trusted',
    name: 'Saksvant',
    minPoints: 75,
    color: 'text-indigo-700 dark:text-indigo-300',
    barColor: 'bg-indigo-500',
    ringColor: 'ring-indigo-200',
    unlocks: 'Nivå «Saksvant» for jevnlig fordypning.',
  },
  {
    id: 'curator',
    name: 'Kunnskapsrik',
    minPoints: 150,
    color: 'text-violet-700 dark:text-violet-300',
    barColor: 'bg-violet-500',
    ringColor: 'ring-violet-200',
    unlocks: 'Nivå «Kunnskapsrik» for vedvarende innsikt.',
  },
  {
    id: 'veteran',
    name: 'Veteran',
    minPoints: 400,
    color: 'text-amber-800 dark:text-amber-200',
    barColor: 'bg-amber-500',
    ringColor: 'ring-amber-200',
    unlocks: 'Nivå «Veteran» for langvarig, informert deltakelse.',
  },
] as const;

export type UserPointsProgress = {
  points: number;
  tier: UserPointTier;
  nextTier: UserPointTier | null;
  progressLabel: string;
  progressPercent: number;
  nextUnlock: string | null;
  isMaxTier: boolean;
};

export function getUserPointTier(points: number): UserPointTier {
  let current = USER_POINT_TIERS[0];
  for (const tier of USER_POINT_TIERS) {
    if (points >= tier.minPoints) {
      current = tier;
    }
  }
  return current;
}

export function getUserPointsProgress(points: number): UserPointsProgress {
  const safePoints = Math.max(0, Math.floor(points));
  const tier = getUserPointTier(safePoints);
  const tierIndex = USER_POINT_TIERS.findIndex((entry) => entry.id === tier.id);
  const nextTier = tierIndex < USER_POINT_TIERS.length - 1 ? USER_POINT_TIERS[tierIndex + 1] : null;
  const isMaxTier = nextTier === null;

  if (isMaxTier) {
    return {
      points: safePoints,
      tier,
      nextTier: null,
      progressLabel: `${safePoints}/${tier.minPoints}`,
      progressPercent: 100,
      nextUnlock: null,
      isMaxTier: true,
    };
  }

  const progressPercent = Math.min(100, Math.round((safePoints / nextTier.minPoints) * 100));

  return {
    points: safePoints,
    tier,
    nextTier,
    progressLabel: `${safePoints}/${nextTier.minPoints}`,
    progressPercent,
    nextUnlock: nextTier.unlocks,
    isMaxTier: false,
  };
}
