import Link from 'next/link';
import { ActionScaleLine } from '@/components/actions/action-scale-line';
import { formatStemmerCount } from '@/lib/norwegian-plural';
import { isPollVotingOpen, pollChoicePercent } from '@/lib/polls/format';
import { formatPollDisplayTitle } from '@/lib/polls/display-title';
import { ACTION_POLL_DISCLAIMER, POLL_BALLOT_CHOICES, pollChoiceLabel, pollStatusLabel } from '@/lib/polls/labels';
import type { PollRecord, PollTotals } from '@/lib/polls/types';
import { routes } from '@/lib/routes';

type ActionPollCardProps = {
  poll: PollRecord;
  totals: PollTotals;
};

export function ActionPollCard({ poll, totals }: ActionPollCardProps) {
  const href = routes.poll(poll.id);
  const title = formatPollDisplayTitle(poll.title);
  const open = isPollVotingOpen(poll);

  return (
    <article className="relative rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={href}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        aria-label={`Åpne aksjon: ${title}`}
      />
      <div className="relative flex flex-wrap items-center gap-2 text-xs font-medium">
        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-amber-800 dark:text-amber-200">
          Aksjon
        </span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
          {open ? pollStatusLabel(poll.status) : 'Avsluttet'}
        </span>
      </div>
      <h3 className="relative mt-3 text-lg font-semibold text-foreground">{title}</h3>
      <p className="relative mt-2 text-sm text-muted-foreground">{ACTION_POLL_DISCLAIMER}</p>
      <ActionScaleLine poll={poll} className="relative mt-2 text-sm text-foreground" />
      <div className="relative mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {POLL_BALLOT_CHOICES.map((choice) => (
          <span key={choice}>
            {pollChoiceLabel(choice)} {pollChoicePercent(totals, choice)}%
          </span>
        ))}
        <span>{formatStemmerCount(totals.total)}</span>
      </div>
    </article>
  );
}
