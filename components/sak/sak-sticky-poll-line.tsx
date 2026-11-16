'use client';

import { PollBallot } from '@/components/polls/poll-ballot';
import { routes } from '@/lib/routes';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import { cn } from '@/lib/utils';

export type SakStickyPollLineProps = {
  pollId: string;
  initialTotals: PollTotals;
  initialVote: PollChoice | null;
  sakId: string;
  className?: string;
};

/** Fast stemmelinje (Nei / Blank / Ja) nederst på sakssiden mens avstemningen er åpen. */
export function SakStickyPollLine({
  pollId,
  initialTotals,
  initialVote,
  sakId,
  className,
}: SakStickyPollLineProps) {
  const loginNext = routes.sak(sakId);

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
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4">
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