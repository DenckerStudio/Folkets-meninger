import { RESEARCH_BRIEF_STATUS_LABELS } from '@/lib/admin/research/labels';
import type { ResearchBriefStatus } from '@/lib/admin/research/types';
import { cn } from '@/lib/utils';

export function ResearchBriefStatusBadge({ status }: { status: ResearchBriefStatus }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-snug',
        status === 'failed' && 'bg-destructive/10 text-destructive',
        status === 'done' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        status === 'running' && 'bg-brand/10 text-brand',
        status === 'queued' && 'bg-muted text-muted-foreground',
      )}
    >
      {RESEARCH_BRIEF_STATUS_LABELS[status]}
    </span>
  );
}
