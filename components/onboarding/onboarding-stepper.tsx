'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ONBOARDING_STEPS, type OnboardingStepId } from '@/lib/onboarding';

type OnboardingStepperProps = {
  current: OnboardingStepId;
};

export function OnboardingStepper({ current }: OnboardingStepperProps) {
  const currentIndex = ONBOARDING_STEPS.findIndex((step) => step.id === current);

  return (
    <ol className="grid grid-cols-4 gap-2">
      {ONBOARDING_STEPS.map((step, index) => {
        const active = step.id === current;
        const done = index < currentIndex;
        return (
          <li key={step.id}>
            <div
              className={cn(
                'flex flex-col gap-0.5 rounded-xl border px-2 py-2.5 sm:px-3',
                active && 'border-brand bg-brand text-brand-foreground',
                done && !active && 'border-brand/20 bg-brand/10 text-brand',
                !active && !done && 'border-border bg-card text-muted-foreground',
              )}
            >
              <span className="inline-flex h-4 items-center text-[0.65rem] font-semibold tracking-wide">
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : String(step.index).padStart(2, '0')}
              </span>
              <span className="truncate text-xs font-semibold">{step.label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
