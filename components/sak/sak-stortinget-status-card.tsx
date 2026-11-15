import Link from 'next/link';
import { Building2, Calendar, ExternalLink, FileText, Landmark } from 'lucide-react';
import { SakSectionHeading } from '@/components/sak/sak-meta';
import type { SakStortingetPublicStatus } from '@/lib/sak/stortinget-public-status';
import { cn } from '@/lib/utils';

type SakStortingetStatusCardProps = {
  status: SakStortingetPublicStatus;
  className?: string;
};

export function SakStortingetStatusCard({ status, className }: SakStortingetStatusCardProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <SakSectionHeading
        title="Status i Stortinget"
        icon="building-2"
        iconClassName="h-5 w-5 text-brand"
      />
      <div className="-mt-2 grid gap-3 sm:grid-cols-2">
        <dl className="space-y-3 text-sm">
          <div className="flex gap-2">
            <dt className="sr-only">Behandlingsstatus</dt>
            <dd className="inline-flex min-h-10 items-center rounded-lg bg-muted/50 px-3 py-2 font-medium text-foreground">
              {status.treatmentLabel}
            </dd>
          </div>
          {status.committee ? (
            <div className="flex gap-2">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Komité
                </dt>
                <dd className="mt-0.5 text-foreground">{status.committee}</dd>
              </div>
            </div>
          ) : null}
          {status.decisionDateLabel ? (
            <div className="flex gap-2">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Vedtak / siste votering
                </dt>
                <dd className="mt-0.5 tabular-nums text-foreground">{status.decisionDateLabel}</dd>
              </div>
            </div>
          ) : null}
          {status.nextMilestoneLabel ? (
            <div className="flex gap-2">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Neste steg
                </dt>
                <dd className="mt-0.5 text-foreground">{status.nextMilestoneLabel}</dd>
              </div>
            </div>
          ) : null}
        </dl>

        {status.documentLinks.length > 0 ? (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              Dokumenter
            </p>
            <ul className="space-y-1.5">
              {status.documentLinks.map((doc) => (
                <li key={doc.id}>
                  {doc.external ? (
                    <a
                      href={doc.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex min-h-10 items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-foreground hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-medium group-hover:text-brand">
                          {doc.title}
                        </span>
                        <span className="text-xs text-muted-foreground">{doc.kindLabel}</span>
                      </span>
                      <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    </a>
                  ) : (
                    <Link
                      href={doc.href}
                      className="group flex min-h-10 items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-foreground hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-medium group-hover:text-brand">
                          {doc.title}
                        </span>
                        <span className="text-xs text-muted-foreground">{doc.kindLabel}</span>
                      </span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <p className="mt-4 border-t border-border pt-3">
        <a
          href={status.stortingetSakUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <Landmark className="h-4 w-4" aria-hidden />
          Åpne saken på stortinget.no
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </p>
    </section>
  );
}