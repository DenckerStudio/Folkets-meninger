import { Award, BadgeCheck } from 'lucide-react';
import { badgeCatalog } from '@/lib/knowledge/badges';
import type { EarnedBadge } from '@/lib/knowledge/types';
import { cn } from '@/lib/utils';

export function KnowledgeBadges({
  earned,
  compact = false,
}: {
  earned: EarnedBadge[];
  compact?: boolean;
}) {
  const earnedAt = new Map(earned.map((row) => [row.id, row.earnedAt]));
  const badges = badgeCatalog();

  return (
    <ul className={cn('grid gap-3', compact ? 'grid-cols-1' : 'sm:grid-cols-3')}>
      {badges.map((badge) => {
        const unlocked = earnedAt.has(badge.id);
        return (
          <li
            key={badge.id}
            className={cn(
              'rounded-xl border px-4 py-3',
              unlocked ? 'border-brand/40 bg-brand/5' : 'border-border bg-muted/30',
            )}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {unlocked ? (
                <BadgeCheck className="h-4 w-4 text-brand" />
              ) : (
                <Award className="h-4 w-4 text-muted-foreground" />
              )}
              {badge.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {unlocked ? badge.description : badge.howToEarn}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
