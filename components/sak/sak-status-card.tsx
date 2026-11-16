import Link from 'next/link';
import type { SakStatusHighlight } from '@/lib/sak/sak-status-highlights';
import { SakProcessingBadge } from '@/components/sak/sak-meta';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import { getStortingetSakUrl } from '@/lib/stortinget-horinger';

const linkFocus =
  'rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card';

export function SakStatusCard({
  sakId,
  highlight,
  className,
}: {
  sakId: string;
  highlight: SakStatusHighlight;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-brand/12 bg-gradient-to-br from-brand-soft to-card p-4 shadow-sm sm:p-5',
        className,
      )}
      aria-label="Saksstatus"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SakProcessingBadge status={highlight.statusKind} size="sm" />
        <span className="text-sm font-medium text-foreground">{highlight.statusLabel}</span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {highlight.nextStepLabel ? (
          <div>
            <dt className="font-medium text-muted-foreground">{highlight.nextStepLabel}</dt>
            <dd className="mt-0.5 text-foreground tabular-nums">{highlight.nextStepDateLabel}</dd>
          </div>
        ) : null}
        {highlight.hearingHref && highlight.hearingLinkLabel ? (
          <div>
            <dt className="font-medium text-muted-foreground">Høring</dt>
            <dd className="mt-0.5">
              <Link
                href={highlight.hearingHref}
                className={cn(
                  'inline-flex min-h-11 items-center font-medium text-brand underline-offset-2 hover:underline',
                  linkFocus,
                )}
              >
                {highlight.hearingLinkLabel}
              </Link>
            </dd>
          </div>
        ) : null}
        {highlight.vedtakExcerpt ? (
          <div className="sm:col-span-2">
            <dt className="font-medium text-muted-foreground">Vedtak</dt>
            <dd className="mt-1 leading-relaxed text-foreground">{highlight.vedtakExcerpt}</dd>
          </div>
        ) : null}
      </dl>

      <a
        href={getStortingetSakUrl(sakId)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'mt-4 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground underline-offset-2 hover:text-brand hover:underline',
          linkFocus,
        )}
      >
        Se på stortinget.no
        <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
      </a>
    </section>
  );
}