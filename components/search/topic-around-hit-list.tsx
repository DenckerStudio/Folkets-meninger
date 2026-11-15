import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { TopicAroundSearchItem } from '@/lib/search/topic-around-search';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

function formatPublishedAt(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Oslo',
  });
}

export function TopicAroundHitList({
  items,
  className,
}: {
  items: readonly TopicAroundSearchItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((item) => {
        const published = formatPublishedAt(item.publishedAt);
        const docLabel = item.documentTitle
          ? `${item.documentTitle}${item.documentKind ? ` (${item.documentKind})` : ''}`
          : 'Stortinget-dokument';

        return (
          <li
            key={`${item.issueId}-${item.documentTitle ?? 'doc'}`}
            className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link
                href={routes.sak(item.issueId)}
                className="min-h-11 text-sm font-semibold text-foreground hover:text-brand hover:underline"
              >
                {item.issueTitle}
              </Link>
              {published ? (
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={item.publishedAt ?? undefined}
                >
                  {published}
                </time>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.relatedReason}</p>
            {item.excerpt ? (
              <blockquote className="mt-2 border-l-2 border-brand/40 pl-3 text-sm text-foreground">
                <p className="line-clamp-5 whitespace-pre-wrap">{item.excerpt}</p>
              </blockquote>
            ) : null}
            <div className="mt-2 text-xs">
              {item.sourceUrl ? (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 font-medium text-brand hover:underline"
                >
                  {docLabel}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : (
                <span className="text-muted-foreground">Kilde: {docLabel}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}