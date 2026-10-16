'use client';

import { cn } from '@/lib/utils';

export type LandingProcessStep = {
  title: string;
  body: string;
};

type LandingProcessTimelineProps = {
  steps: readonly LandingProcessStep[];
  className?: string;
};

/** Vertical process timeline (layout inspired by 21st.dev timeline-05). */
export function LandingProcessTimeline({ steps, className }: LandingProcessTimelineProps) {
  return (
    <ol className={cn('relative space-y-0', className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.title} className="relative flex gap-4 pb-10 last:pb-0">
            {!isLast ? (
              <span
                className="absolute left-[1.125rem] top-10 bottom-0 w-px bg-[#00205b]/15"
                aria-hidden
              />
            ) : null}
            <span
              className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#00205b]/15 bg-[#00205b]/[0.04] text-sm font-bold text-[#00205b]"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <h4 className="text-base font-semibold text-[#001433]">{step.title}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-pretty text-[#001433]/70">{step.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
