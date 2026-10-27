'use client';

import { cn } from '@/lib/utils';

export type DraftReviewQueue = 'pending' | 'expired';

type Props = {
  queue: DraftReviewQueue;
  onQueueChange: (queue: DraftReviewQueue) => void;
  pendingLabel?: string;
  expiredLabel?: string;
  className?: string;
};

export function DraftReviewQueueToggle({
  queue,
  onQueueChange,
  pendingLabel = 'Til vurdering',
  expiredLabel = 'Utløpte',
  className,
}: Props) {
  return (
    <div
      role="group"
      aria-label="Velg kø"
      className={cn('flex flex-wrap gap-1 rounded-xl bg-muted/40 p-1', className)}
    >
      {(
        [
          { id: 'pending' as const, label: pendingLabel },
          { id: 'expired' as const, label: expiredLabel },
        ] as const
      ).map((item) => {
        const selected = queue === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onQueueChange(item.id)}
            className={cn(
              'inline-flex min-h-11 min-w-[8.5rem] flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
              selected
                ? 'bg-card text-brand shadow-sm'
                : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
