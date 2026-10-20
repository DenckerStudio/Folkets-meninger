import {
  RESEARCH_BRIEF_STATUS_LABELS,
  RESEARCH_KIND_LABELS,
} from '@/lib/admin/research/labels';
import type { ResearchBriefKind, ResearchBriefStatus } from '@/lib/admin/research/types';
import { cn } from '@/lib/utils';

export function ResearchBriefStatusBadge({
  status,
  kind,
}: {
  status: ResearchBriefStatus;
  kind?: ResearchBriefKind;
}) {
  const statusLabel = RESEARCH_BRIEF_STATUS_LABELS[status];
  const label =
    kind && (status === 'queued' || status === 'running' || status === 'failed')
      ? `${RESEARCH_KIND_LABELS[kind]} · ${statusLabel}`
      : statusLabel;

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
      {label}
    </span>
  );
}
