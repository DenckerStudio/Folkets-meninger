'use client';

import Link from 'next/link';
import { Sparkles, Trophy } from 'lucide-react';
import { REEL_SUBMIT_TRUSTED_POINTS } from '@/lib/forum/reel-submission-access';
import type { UserPointsProgress } from '@/lib/user-points-levels';
import { getUserPointsProgress } from '@/lib/user-points-levels';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type PointsProgressProps = {
  points: number;
  progress?: UserPointsProgress;
  className?: string;
  compact?: boolean;
  showHeading?: boolean;
};

export function PointsProgress({
  points,
  progress,
  className,
  compact = false,
  showHeading = true,
}: PointsProgressProps) {
  const state = progress ?? getUserPointsProgress(points);

  return (
    <div className={cn('rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-sm', className)}>
      {showHeading && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Poeng og tillit</p>
              <p className={cn('text-sm font-bold', state.tier.color)}>{state.tier.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Poeng</p>
            <p className="text-2xl font-bold text-[#00205b]">{state.points}</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-gray-700">
            {state.isMaxTier ? 'Høyeste nivå nådd' : `Mot ${state.nextTier?.name ?? 'neste nivå'}`}
          </span>
          <span className={cn('font-bold tabular-nums', state.tier.color)}>{state.progressLabel}</span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-white/80 ring-1 ring-amber-100">
          <div
            className={cn('h-full rounded-full transition-all duration-500', state.tier.barColor)}
            style={{ width: `${state.progressPercent}%` }}
            role="progressbar"
            aria-valuenow={state.points}
            aria-valuemin={0}
            aria-valuemax={state.nextTier?.minPoints ?? state.tier.minPoints}
            aria-label={`Fremdrift mot neste nivå: ${state.progressLabel}`}
          />
        </div>

        {!compact && state.nextUnlock && (
          <p className="text-sm leading-6 text-gray-600">
            <span className="font-medium text-gray-800">Neste nivå åpner:</span> {state.nextUnlock}
          </p>
        )}

        {!compact && state.isMaxTier && (
          <p className="text-sm leading-6 text-amber-900">
            Du har nådd Veteran-nivå. Takk for langvarig, konstruktiv deltakelse.
          </p>
        )}

        {points >= REEL_SUBMIT_TRUSTED_POINTS ? (
          <Link
            href={routes.forumForeslaReel}
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-600"
          >
            <Sparkles className="h-4 w-4" />
            Foreslå forum-reel
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function PointsTierBadge({ points, className }: { points: number; className?: string }) {
  const state = getUserPointsProgress(points);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold ring-1',
        state.tier.color,
        state.tier.ringColor,
        className,
      )}
    >
      <Trophy className="h-3.5 w-3.5" />
      {state.tier.name} · {state.points} poeng
    </span>
  );
}
