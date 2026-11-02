import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import { cn } from '@/lib/utils';

const SUBREDDIT_BADGE_CLASS: Record<RedditSignalSubreddit, string> = {
  norge: 'border-brand/30 bg-brand/10 text-brand',
  norske: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  Nordmenn: 'border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-300',
};

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
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-snug',
        SUBREDDIT_BADGE_CLASS[subreddit],
        className,
      )}
    >
      {redditSubredditLabel(subreddit)}
    </span>
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
