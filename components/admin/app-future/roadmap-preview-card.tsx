'use client';

import { Badge } from '@/components/ui/badge';
import { MarkdownLite } from '@/components/admin/app-future/markdown-lite';
import { roadmapStatusLabel, type RoadmapItem, type RoadmapStatus } from '@/lib/appens-fremtid/constants';
import { sortRoadmapItems } from '@/lib/appens-fremtid/roadmap';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<RoadmapStatus, string> = {
  planned: 'bg-muted text-muted-foreground',
  in_progress: 'bg-brand/15 text-brand',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

export function RoadmapItemPreview({
  title,
  body,
  status,
  compact,
}: {
  title: string;
  body: string;
  status: RoadmapStatus;
  compact?: boolean;
}) {
  return (
    <article
      className={cn(
        'rounded-xl border border-border bg-muted/30 p-4',
        compact && 'p-3',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn('border-0', STATUS_BADGE[status])}>{roadmapStatusLabel(status)}</Badge>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Forhåndsvisning
        </span>
      </div>
      <h4 className={cn('mt-2 font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
        {title.trim() || 'Uten tittel'}
      </h4>
      {body.trim() ? (
        <MarkdownLite source={body} className="mt-2 text-muted-foreground" />
      ) : (
        <p className="mt-2 text-sm italic text-muted-foreground">Beskrivelse mangler.</p>
      )}
    </article>
  );
}

/** Kompakt veikart i admin — tema-tokens, ingen landing-fullbredde. */
export function RoadmapAdminTimelinePreview({
  items,
  highlightId,
}: {
  items: RoadmapItem[];
  highlightId?: string | null;
}) {
  const sorted = sortRoadmapItems(items);

  if (sorted.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        Ingen veikartpunkter ennå. Legg til det første punktet.
      </p>
    );
  }

  return (
    <div className="relative isolate overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5">
      <header className="mb-4 border-b border-border pb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Veikart</p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">Veien videre</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">Slik vises listen på den offentlige siden.</p>
      </header>
      <ol className="relative space-y-0">
        <div
          className="pointer-events-none absolute bottom-2 left-[0.55rem] top-2 w-px bg-border sm:left-[0.65rem]"
          aria-hidden
        />
        {sorted.map((item) => {
          const highlighted = highlightId === item.id;
          return (
            <li
              key={item.id}
              className={cn(
                'relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 py-3 first:pt-0 last:pb-0',
                highlighted && 'rounded-lg bg-brand/5 ring-1 ring-brand/20',
              )}
            >
              <span
                className={cn(
                  'relative z-[1] mt-1.5 block h-3 w-3 rounded-full border-2 border-background',
                  item.status === 'done' && 'bg-emerald-600',
                  item.status === 'in_progress' && 'bg-brand',
                  item.status === 'planned' && 'bg-muted-foreground/40',
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn('border-0', STATUS_BADGE[item.status])}>
                    {roadmapStatusLabel(item.status)}
                  </Badge>
                </div>
                <p className="mt-1 font-medium text-foreground">{item.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
