import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { OpinionPointsList } from '@/components/opinions/opinion-points-list';
import { formatOpinionDate, stanceLabel, STANCE_VISUAL } from '@/lib/opinions/labels';
import type { OpinionListItem } from '@/lib/opinions/types';
import { formatNumber } from '@/lib/utils';
import { routes } from '@/lib/routes';

type OpinionCardProps = {
  opinion: OpinionListItem;
};

export function OpinionCard({ opinion }: OpinionCardProps) {
  const visual = STANCE_VISUAL[opinion.stance];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link href={routes.opinion(opinion.id)} className="block p-6 pb-4">
        <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: visual.bg, color: visual.fg, boxShadow: opinion.stance === 'blank' ? `inset 0 0 0 1px ${visual.ring}` : undefined }}
            >
              {stanceLabel(opinion.stance)}
            </span>
            {opinion.stortingetIssueId ? (
              <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                {opinion.issueTitle ?? `Sak ${opinion.stortingetIssueId}`}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground md:text-right">{formatOpinionDate(opinion.createdAt)}</p>
        </div>

        <h2 className="mb-2 text-xl font-semibold text-foreground">{opinion.title}</h2>
        <OpinionPointsList points={opinion.points} compact className="mb-4" />
        {opinion.body.trim() ? (
          <p className="mb-4 line-clamp-2 text-muted-foreground">{opinion.body}</p>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <span className="mr-1 font-medium text-foreground">{formatNumber(opinion.counts.total)}</span>
              meninger
            </span>
            <span className="text-xs">
              Imot {opinion.counts.imot} · Blank {opinion.counts.blank} · For {opinion.counts.for}
            </span>
          </div>
          <span className="flex items-center text-sm font-medium text-brand">
            Les mer <ArrowRight className="ml-1 h-4 w-4" />
          </span>
        </div>
      </Link>

      <div className="flex flex-col justify-between gap-3 border-t border-border bg-muted/40 px-6 py-4 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          {opinion.authorName ? (
            <>
              Delt av <span className="font-medium text-foreground">{opinion.authorName}</span>
            </>
          ) : (
            'Delt av en innbygger'
          )}
        </p>
        <Link
          href={routes.opinion(opinion.id)}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          Si For, Blank eller Imot
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
