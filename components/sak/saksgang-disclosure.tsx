import { ChevronDown, GitBranch } from 'lucide-react';
import { SaksgangTimeline } from '@/components/sak/saksgang-timeline';
import { saksgangFinishedSummaryLabel, type SaksgangStep } from '@/lib/sak/saksgang-steps';

export const SAK_OVERSIKT_SAKSGANG_ANCHOR_ID = 'sak-oversikt-saksgang';

/** Saksgangen til en avsluttet sak er historikk: foldet sammen lenger ned på Oversikt. */
export function SaksgangDisclosure({
  saksgangName,
  steps,
  finishedDateLabel,
}: {
  saksgangName?: string | null;
  steps: SaksgangStep[];
  finishedDateLabel?: string | null;
}) {
  if (steps.length === 0) return null;

  return (
    <details
      id={SAK_OVERSIKT_SAKSGANG_ANCHOR_ID}
      className="group scroll-mt-below-sak-tabs rounded-2xl border border-border bg-card px-4 shadow-sm sm:px-6"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card [&::-webkit-details-marker]:hidden">
        <span className="inline-flex min-w-0 items-center gap-2">
          <GitBranch className="h-5 w-5 shrink-0 text-brand" aria-hidden />
          <span className="break-words">{saksgangFinishedSummaryLabel(finishedDateLabel)}</span>
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="pb-5 pt-2">
        <SaksgangTimeline saksgangName={saksgangName} steps={steps} ferdigbehandlet embedded />
      </div>
    </details>
  );
}
