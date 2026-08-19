import Link from 'next/link';
import { pollChoicePercent } from '@/lib/polls/format';
import { pollChoiceLabel, pollStatusLabel, pollTrackLabel } from '@/lib/polls/labels';
import type { PollChoice, PollRecord, PollTotals } from '@/lib/polls/types';
import { routes } from '@/lib/routes';

const CHOICES: PollChoice[] = ['ja', 'nei', 'blank'];

type PollCardProps = {
  poll: PollRecord;
  totals: PollTotals;
};

export function PollCard({ poll, totals }: PollCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-brand">{pollTrackLabel(poll.track)}</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
          {pollStatusLabel(poll.status)}
        </span>
      </div>
      <h2 className="mt-3 text-lg font-semibold text-foreground">
        <Link href={routes.poll(poll.id)} className="hover:text-brand">
          {poll.title}
        </Link>
      </h2>
      {poll.neutralSummary ? (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{poll.neutralSummary}</p>
      ) : null}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {CHOICES.map((choice) => (
          <div key={choice} className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-center">
            <p className="text-xs font-medium text-muted-foreground">{pollChoiceLabel(choice)}</p>
            <p className="text-lg font-semibold text-foreground">{pollChoicePercent(totals, choice)}%</p>
            <p className="text-xs text-muted-foreground">{totals[choice]}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{totals.total} stemmer</span>
        <Link href={routes.poll(poll.id)} className="font-medium text-brand hover:underline">
          Åpne avstemning
        </Link>
      </div>
    </article>
  );
}
