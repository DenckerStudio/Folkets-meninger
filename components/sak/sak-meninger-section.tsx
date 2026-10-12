import Link from 'next/link';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { getIssueOpinionSummary } from '@/lib/opinions/service';
import { STANCE_VISUAL, formatOpinionDate, stanceLabel } from '@/lib/opinions/labels';
import type { OpinionStance } from '@/lib/opinions/types';
import { routes } from '@/lib/routes';
import { formatNumber } from '@/lib/utils';

const FLAG_STANCES: readonly OpinionStance[] = ['for', 'blank', 'imot'];

export async function SakMeningerSection({ sakId }: { sakId: string }) {
  const { total, counts, latest } = await getIssueOpinionSummary(sakId);
  const allHref = routes.folketsMeningerForSak(sakId);
  const composeHref = routes.folketsMeningerForSak(sakId, { compose: true });

  return (
    <section
      data-sak-meninger=""
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <MessageSquare className="h-5 w-5 text-brand" />
            Folkets meninger om saken
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0
              ? `${formatNumber(total)} mening${total === 1 ? '' : 'er'} delt`
              : 'Ingen har delt en mening ennå.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={composeHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90"
          >
            Del din mening
          </Link>
          {total > 0 ? (
            <Link
              href={allHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:border-brand/40 hover:text-brand"
            >
              Se alle meninger
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>

      {total > 0 ? (
        <>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            {FLAG_STANCES.map((stance) => {
              const value = counts[stance];
              if (value <= 0) return null;
              return (
                <div
                  key={stance}
                  className="h-full"
                  style={{
                    width: `${(value / total) * 100}%`,
                    backgroundColor:
                      stance === 'blank' ? 'var(--muted-foreground)' : STANCE_VISUAL[stance].bg,
                  }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {FLAG_STANCES.map((stance) => (
              <span key={stance}>
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{
                    backgroundColor:
                      stance === 'blank' ? 'var(--muted-foreground)' : STANCE_VISUAL[stance].bg,
                  }}
                />
                {stanceLabel(stance)} {counts[stance]}
              </span>
            ))}
          </div>

          <ul className="mt-4 space-y-3">
            {latest.map((opinion) => {
              const visual = STANCE_VISUAL[opinion.stance];
              return (
                <li key={opinion.id}>
                  <Link
                    href={routes.opinion(opinion.id)}
                    className="block rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:border-brand/40 hover:bg-brand/5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ backgroundColor: visual.bg, color: visual.fg }}
                      >
                        {stanceLabel(opinion.stance)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatOpinionDate(opinion.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-sm font-medium text-foreground">
                      {opinion.title}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          Bli den første til å dele en mening om denne saken.
        </p>
      )}
    </section>
  );
}
