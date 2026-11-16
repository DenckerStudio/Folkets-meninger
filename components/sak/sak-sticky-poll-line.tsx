'use client';

import { PollBallot } from '@/components/polls/poll-ballot';
import { NonRepresentativeNotice } from '@/components/trust/non-representative-notice';
import { formatPollDisplayTitle } from '@/lib/polls/display-title';
import { routes } from '@/lib/routes';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import { cn } from '@/lib/utils';

export type SakStickyPollLineProps = {
  pollId: string;
  initialTotals: PollTotals;
  initialVote: PollChoice | null;
  sakId: string;
  pollTitle?: string | null;
  totalsLoadError?: boolean;
  className?: string;
};

function stickyQuestionLabel(pollTitle?: string | null): string {
  const trimmed = pollTitle?.trim() ?? '';
  if (!trimmed) return 'Hva mener du om saken?';
  return formatPollDisplayTitle(trimmed);
}

/** Fast stemmelinje (Nei / Blank / Ja) nederst på sakssiden mens avstemningen er åpen. */
export function SakStickyPollLine({
  pollId,
  initialTotals,
  initialVote,
  sakId,
  pollTitle,
  totalsLoadError = false,
  className,
}: SakStickyPollLineProps) {
  const loginNext = routes.sak(sakId);
  const question = stickyQuestionLabel(pollTitle);

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.2)] backdrop-blur supports-[backdrop-filter]:bg-background/90',
        'pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3',
        className,
      )}
      role="region"
      aria-label="Stem på saken"
    >
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-2 px-4">
        <p className="text-sm font-semibold leading-snug text-foreground">{question}</p>
        <div
          title="Blant brukerne av Folkets Meninger — ikke representativt for hele befolkningen."
          className="min-w-0"
        >
          <NonRepresentativeNotice
            count={totalsLoadError ? undefined : initialTotals.total}
            countLabel="stemmer"
            countLabelSingular="stemme"
            className="line-clamp-2"
          />
        </div>
        {totalsLoadError ? (
          <p className="text-xs text-muted-foreground" role="status">
            Stemmetall er ikke tilgjengelig akkurat nå. Du kan fortsatt stemme.
          </p>
        ) : null}
        <PollBallot
          pollId={pollId}
          votingOpen
          initialTotals={initialTotals}
          initialVote={initialVote}
          loginNext={loginNext}
          compact
        />
      </div>
    </div>
  );
}