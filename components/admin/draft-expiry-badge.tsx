'use client';

import {
  formatDraftExpiryLabel,
  type DraftSoftExpiryClock,
} from '@/lib/admin/draft-expiry';
import { cn } from '@/lib/utils';

type Props = {
  clock: DraftSoftExpiryClock;
  className?: string;
};

export function DraftExpiryBadge({ clock, className }: Props) {
  if (!clock.createdAt && !clock.restoredAt) return null;
  const label = formatDraftExpiryLabel(clock);
  const urgent = label === 'Utløper snart';
  return (
    <span
      className={cn(
        'inline-flex min-h-[2.75rem] items-center rounded-lg px-3 py-1.5 text-xs font-medium',
        urgent
          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
          : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {label}
    </span>
  );
}
