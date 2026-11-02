import type { OppfangetRedditRow } from '@/lib/admin/oppfanget/types';
import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import { cn } from '@/lib/utils';

const subredditBadgeClass =
  'inline-flex max-w-full items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium leading-snug text-foreground';

export function redditSubredditLabel(subreddit: RedditSignalSubreddit): string {
  return `r/${subreddit}`;
}

export function RedditSubredditBadge({
  subreddit,
  className,
}: {
  subreddit: RedditSignalSubreddit;
  className?: string;
}) {
  return (
    <span className={cn(subredditBadgeClass, className)}>{redditSubredditLabel(subreddit)}</span>
  );
}

export function formatRedditContention(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString('nb-NO', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

const rtf = new Intl.RelativeTimeFormat('nb', { numeric: 'auto' });

export function formatRedditSnapshotRelative(iso: string, nowMs = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffSec = Math.round((then - nowMs) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 48) return rtf.format(diffHour, 'hour');
  const diffDay = Math.round(diffHour / 24);
  return rtf.format(diffDay, 'day');
}

export function redditSnapshotUpdatedLabel(iso: string, nowMs = Date.now()): string {
  return `Oppdatert ${formatRedditSnapshotRelative(iso, nowMs)}`;
}

export function redditRelatedIssueLinkLabel(row: OppfangetRedditRow): string {
  const title = row.relatedIssueTitle?.trim();
  if (title) return title;
  if (row.relatedIssueId) return `Sak ${row.relatedIssueId}`;
  return '';
}

export function RedditEngagementMeta({ row }: { row: OppfangetRedditRow }) {
  return (
    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
      <span>{row.score.toLocaleString('nb-NO')} poeng</span>
      <span aria-hidden> · </span>
      <span>{row.numComments.toLocaleString('nb-NO')} kommentarer</span>
      <span aria-hidden> · </span>
      <span title="kommentarer per poeng">
        {formatRedditContention(row.contention)} kommentarer per poeng
      </span>
    </p>
  );
}
