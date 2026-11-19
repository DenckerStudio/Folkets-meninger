'use client';

import { GitBranch } from 'lucide-react';
import { getSakEventTooltip, getSakStepTooltip, SAK_META_TOOLTIPS } from '@/lib/stortinget-sak-tooltips';
import { useSakTooltipsEnabled } from '@/components/theme-provider';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { resolveCurrentSaksgangStepIndex } from '@/lib/sak/saksgang-current-step';
import type { SaksgangStep } from '@/lib/sak/saksgang-steps';
import { cn } from '@/lib/utils';

export type { SaksgangEvent, SaksgangStep } from '@/lib/sak/saksgang-steps';

type SaksgangTimelineProps = {
  saksgangName?: string | null;
  steps: SaksgangStep[];
  ferdigbehandlet?: boolean;
};

function cleanSaksgangName(name: string): string {
  return name.replace(/^K(?=[A-ZÆØÅ][a-zæøå])/, '');
}

function EventLabel({
  eventId,
  label,
  showTooltips,
}: {
  eventId?: string;
  label: string;
  showTooltips: boolean;
}) {
  const tooltip = getSakEventTooltip(eventId, label);

  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span>{label}</span>
      {showTooltips && tooltip ? <InfoTooltip label={label} description={tooltip} side="bottom" /> : null}
    </span>
  );
}

export function SaksgangTimeline({ saksgangName, steps, ferdigbehandlet }: SaksgangTimelineProps) {
  const showTooltips = useSakTooltipsEnabled();

  if (steps.length === 0) return null;

  const currentIndex = resolveCurrentSaksgangStepIndex(steps, Boolean(ferdigbehandlet));
  const lastReachedIndex = steps.reduce(
    (last, step, i) => (step.events.some((e) => e.label || e.date) ? i : last),
    -1,
  );

  return (
    <div className="rounded-2xl border border-brand/12 bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="flex items-center text-lg font-bold text-foreground">
          <GitBranch className="mr-2 h-5 w-5 text-brand" aria-hidden />
          Saksgang
        </h2>
        {showTooltips ? (
          <InfoTooltip label="Saksgang" description={SAK_META_TOOLTIPS.saksgang} side="bottom" />
        ) : null}
      </div>
      {saksgangName ? (
        <p className="mb-4 text-sm text-muted-foreground">{cleanSaksgangName(saksgangName)}</p>
      ) : null}

      <ol className="relative space-y-0" aria-label="Saksgang">
        {steps.map((steg, i) => {
          const isLast = i === steps.length - 1;
          const meaningfulEvents = steg.events.filter((e) => e.label || e.date);
          const stepDone = meaningfulEvents.length > 0;
          const isCurrent = i === currentIndex;
          const isFinished = Boolean(ferdigbehandlet) && i === lastReachedIndex;
          const stepTooltip = getSakStepTooltip(steg.navn);

          return (
            <li key={`${steg.navn}-${i}`} className="relative flex gap-4 pb-8 last:pb-0">
              {!isLast ? (
                <span className="absolute left-[1.125rem] top-10 bottom-0 w-px bg-brand/15" aria-hidden />
              ) : null}
              <span
                className={cn(
                  'relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold',
                  isCurrent
                    ? 'border-brand-accent/40 bg-brand-accent-soft text-brand-accent'
                    : stepDone && ferdigbehandlet
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : stepDone
                        ? 'border-brand/25 bg-brand/5 text-brand'
                        : 'border-border bg-muted/40 text-muted-foreground',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div
                    className={cn(
                      'text-sm font-semibold',
                      !stepDone && !isCurrent ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {steg.navn}
                  </div>
                  {isCurrent ? (
                    <span className="rounded-full border border-brand-accent/30 bg-brand-accent-soft px-2 py-0.5 text-xs font-medium text-brand-accent">
                      Nå
                    </span>
                  ) : null}
                  {isFinished ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Avsluttet
                    </span>
                  ) : null}
                  {showTooltips && stepTooltip ? (
                    <InfoTooltip label={steg.navn} description={stepTooltip} side="bottom" />
                  ) : null}
                </div>
                {meaningfulEvents.length > 0 ? (
                  <div className="mt-1.5 space-y-1">
                    {meaningfulEvents.map((evt, j) => (
                      <div key={`${evt.label}-${j}`} className="flex flex-wrap items-baseline gap-2 text-xs">
                        {evt.label ? (
                          <EventLabel eventId={evt.id} label={evt.label} showTooltips={showTooltips} />
                        ) : null}
                        {evt.date ? <span className="text-muted-foreground/80">{evt.date}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}