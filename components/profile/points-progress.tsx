'use client';

import { getUserPointTier, type UserPointsProgress } from '@/lib/user-points-levels';
import { cn } from '@/lib/utils';

export function PointsProgress({
  points = 0,
  progress,
  compact = false,
}: {
  points?: number;
  progress?: UserPointsProgress | null;
  compact?: boolean;
}) {
  const resolved = progress ?? {
    points,
    tier: getUserPointTier(points),
    nextTier: null,
    progressLabel: `${points}`,
    progressPercent: 0,
    nextUnlock: null,
    isMaxTier: true,
  };

  return (
    <div className={cn('rounded-xl border border-border bg-muted/40 px-4 py-3', compact && 'px-3 py-2')}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Kunnskapsnivå
        </p>
        <p className="text-sm font-semibold text-foreground">{resolved.tier.name}</p>
      </div>
      <p className="mt-1 text-2xl font-bold text-brand">{resolved.points}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', resolved.tier.barColor)}
          style={{ width: `${resolved.progressPercent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {resolved.isMaxTier
          ? resolved.tier.unlocks
          : `${resolved.progressLabel} mot ${resolved.nextTier?.name ?? ''}`}
      </p>
    </div>
  );
}

export function PointsTierBadge({ points, className }: { points: number; className?: string }) {
  const tier = getUserPointTier(points);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold',
        tier.color,
        className,
      )}
    >
      {tier.name}
    </span>
  );
}
