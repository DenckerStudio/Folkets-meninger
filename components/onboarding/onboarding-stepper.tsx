'use client';

import { cn } from '@/lib/utils';
import {
  formatOnboardingStepIndex,
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from '@/lib/onboarding';

type OnboardingStepperProps = {
  current: OnboardingStepId;
};

export function OnboardingStepper({ current }: OnboardingStepperProps) {
  const currentIndex = ONBOARDING_STEPS.findIndex((step) => step.id === current);

  return (
    <ol className="grid grid-cols-4 border-b border-foreground/15">
      {ONBOARDING_STEPS.map((step, index) => {
        const active = step.id === current;
        const done = index < currentIndex;
        return (
          <li
            key={step.id}
            className={cn(
              'relative flex flex-col gap-1 px-2 py-3 sm:px-3 sm:py-4',
              index > 0 && 'border-l border-foreground/15',
            )}
          >
            {active ? (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-accent" aria-hidden />
            ) : null}
            <span
              className={cn(
                'font-mono text-[0.65rem] font-medium tracking-[0.18em]',
                active ? 'text-brand-accent' : done ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {formatOnboardingStepIndex(step.index)}
            </span>
            <span
              className={cn(
                'text-[0.7rem] font-semibold uppercase tracking-[0.16em] sm:text-xs',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
