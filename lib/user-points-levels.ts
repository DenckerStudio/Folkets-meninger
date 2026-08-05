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
    unlocks: 'Les, stem på saker og del i forumet.',
  },
  {
    id: 'active',
    name: 'Aktiv',
    minPoints: 250,
    color: 'text-sky-700',
    barColor: 'bg-sky-500',
    ringColor: 'ring-sky-200',
    unlocks: 'Synlig «Aktiv»-merke på profilen din.',
  },
  {
    id: 'trusted',
    name: 'Pålitelig',
    minPoints: 750,
    color: 'text-indigo-700',
    barColor: 'bg-indigo-500',
    ringColor: 'ring-indigo-200',
    unlocks: 'Foreslå forum-reels som admin kan godkjenne.',
  },
  {
    id: 'curator',
    name: 'Kurator',
    minPoints: 2000,
    color: 'text-violet-700',
    barColor: 'bg-violet-500',
    ringColor: 'ring-violet-200',
    unlocks: 'Publiser reels fra godkjente nyhetskilder uten admin-godkjenning.',
  },
  {
    id: 'veteran',
    name: 'Veteran',
    minPoints: 5000,
    color: 'text-amber-800',
    barColor: 'bg-amber-500',
    ringColor: 'ring-amber-200',
    unlocks: 'Foreslå nye nyhetskilder og høyere publiseringsgrense.',
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
