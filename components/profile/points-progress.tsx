'use client';

/**
 * Legacy points UI kept as a thin stub so old imports do not break during removal.
 * Forum gamification is retired; prefer activity counts on Min side / public profile.
 */
export function PointsProgress(_props: {
  points?: number;
  progress?: unknown;
  compact?: boolean;
}) {
  return null;
}

export function PointsTierBadge(_props: { points: number; className?: string }) {
  return null;
}
