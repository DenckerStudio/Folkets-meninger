import Link from 'next/link';
import { formatStemmerCount } from '@/lib/norwegian-plural';
import { pollChoicePercent } from '@/lib/polls/format';
import { formatPollDisplayTitle } from '@/lib/polls/display-title';
import {
  POLL_BALLOT_CHOICES,
  pollChoiceLabel,
  pollStatusLabel,
  pollTrackLabel,
  SYSTEM_REEL_DISCLAIMER,
} from '@/lib/polls/labels';
import type { PollRecord, PollTotals } from '@/lib/polls/types';
import { routes } from '@/lib/routes';

type PollCardProps = {
  poll: PollRecord;
  totals: PollTotals;
};

export function PollCard({ poll, totals }: PollCardProps) {
  const href = routes.poll(poll.id);
  const title = formatPollDisplayTitle(poll.title);

  return (
    <article className="relative rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={href}
        className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        aria-label={`Åpne avstemning: ${title}`}
      />
      <div className="relative flex flex-wrap items-center gap-2 text-xs font-medium">
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-brand">{pollTrackLabel(poll.track)}</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
          {pollStatusLabel(poll.status)}
        </span>
      </div>
      <h2 className="relative mt-3 text-lg font-semibold text-foreground">
        <span className="hover:text-brand">{title}</span>
      </h2>
      {poll.neutralSummary ? (
        <p className="relative mt-2 line-clamp-3 text-sm text-muted-foreground">{poll.neutralSummary}</p>
      ) : null}
      {poll.track === 'system' ? (
        <p className="relative mt-2 text-xs leading-relaxed text-muted-foreground">{SYSTEM_REEL_DISCLAIMER}</p>
      ) : null}
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        {POLL_BALLOT_CHOICES.map((choice) => (
          <div key={choice} className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-center">
            <p className="text-xs font-medium text-muted-foreground">{pollChoiceLabel(choice)}</p>
            <p className="text-lg font-semibold text-foreground">{pollChoicePercent(totals, choice)}%</p>
            <p className="text-xs text-muted-foreground">{totals[choice]}</p>
          </div>
        ))}
      </div>
      <div className="relative mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{formatStemmerCount(totals.total)}</span>
        <span className="inline-flex min-h-11 items-center font-medium text-brand">Åpne avstemning</span>
      </div>
    </article>
  );
}
