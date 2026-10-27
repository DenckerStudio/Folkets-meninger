'use client';

import { formatDraftExpiryLabel } from '@/lib/admin/draft-expiry';
import { cn } from '@/lib/utils';

type Props = {
  createdAt: string | null;
  className?: string;
};

export function DraftExpiryBadge({ createdAt, className }: Props) {
  if (!createdAt) return null;
  const label = formatDraftExpiryLabel(createdAt);
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
