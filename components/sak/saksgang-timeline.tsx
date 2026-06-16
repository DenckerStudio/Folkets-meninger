'use client';

import { GitBranch } from 'lucide-react';
import { getSakEventTooltip, getSakStepTooltip, SAK_META_TOOLTIPS } from '@/lib/stortinget-sak-tooltips';
import { useSakTooltipsEnabled } from '@/components/theme-provider';
import { InfoTooltip } from '@/components/ui/info-tooltip';

export type SaksgangEvent = {
  id?: string;
  label: string | null;
  date: string | null;
};

export type SaksgangStep = {
  navn: string;
  events: SaksgangEvent[];
};

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

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-lg font-bold text-foreground flex items-center">
          <GitBranch className="w-5 h-5 mr-2 text-indigo-600" />
          Saksgang
        </h2>
        {showTooltips ? (
          <InfoTooltip label="Saksgang" description={SAK_META_TOOLTIPS.saksgang} side="bottom" />
        ) : null}
      </div>
      {saksgangName ? (
        <p className="text-sm text-muted-foreground mb-4">{cleanSaksgangName(saksgangName)}</p>
      ) : null}

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
        <div className="space-y-4">
          {steps.map((steg, i) => {
            const isLast = i === steps.length - 1;
            const meaningfulEvents = steg.events.filter((e) => e.label || e.date);
            const stepDone = meaningfulEvents.length > 0;
            const stepTooltip = getSakStepTooltip(steg.navn);

            return (
              <div key={`${steg.navn}-${i}`} className="relative pl-10">
                <div
                  className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                    stepDone && ferdigbehandlet
                      ? 'bg-emerald-500 border-emerald-500'
                      : isLast && !ferdigbehandlet
                        ? 'bg-indigo-500 border-indigo-500'
                        : stepDone
                          ? 'bg-indigo-500 border-indigo-500'
                          : 'bg-card border-border'
                  }`}
                  style={{ top: '0.35rem' }}
                />
                <div className="flex items-center gap-1.5">
                  <div
                    className={`text-sm font-semibold ${
                      !stepDone ? 'text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {steg.navn}
                  </div>
                  {showTooltips && stepTooltip ? (
                    <InfoTooltip label={steg.navn} description={stepTooltip} side="bottom" />
                  ) : null}
                </div>
                {meaningfulEvents.length > 0 ? (
                  <div className="mt-1.5 space-y-1">
                    {meaningfulEvents.map((evt, j) => (
                      <div key={`${evt.label}-${j}`} className="flex items-baseline gap-2 text-xs">
                        {evt.label ? (
                          <EventLabel eventId={evt.id} label={evt.label} showTooltips={showTooltips} />
                        ) : null}
                        {evt.date ? <span className="text-muted-foreground/80">{evt.date}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
