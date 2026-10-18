'use client';

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ROADMAP_STATUSES,
  roadmapStatusLabel,
  type RoadmapStatus,
} from '@/lib/appens-fremtid/constants';

const STATUS_ICON: Record<RoadmapStatus, typeof Circle> = {
  planned: Circle,
  in_progress: Loader2,
  done: CheckCircle2,
};

export function RoadmapStatusField({
  value,
  onChange,
  disabled,
}: {
  value: RoadmapStatus;
  onChange: (status: RoadmapStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Status"
    >
      {ROADMAP_STATUSES.map((status) => {
        const Icon = STATUS_ICON[status];
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(status)}
            className={cn(
              'inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:min-w-[7.5rem]',
              active
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground',
              disabled && 'opacity-50',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', status === 'in_progress' && active && 'animate-spin')} />
            {roadmapStatusLabel(status)}
          </button>
        );
      })}
    </div>
  );
}
