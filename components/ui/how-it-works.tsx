'use client';

import type { ReactNode } from 'react';
import { LandingHeadingRule } from '@/components/icons/civic';
import { HighlightPhrase } from '@/components/ui/highlight-phrase';
import {
  HOW_IT_WORKS_DESCRIPTION,
  HOW_IT_WORKS_KEYWORD,
  HOW_IT_WORKS_STEPS,
  HOW_IT_WORKS_TITLE,
} from '@/lib/landing/homepage-copy';
import { cn } from '@/lib/utils';

export interface Step {
  title: string;
  description: string;
  colorTheme?: 'red' | 'blue' | 'navy';
  colors?: {
    bg: string;
    text: string;
    border: string;
  };
}

export interface HowItWorksProps {
  features?: readonly Step[];
  className?: string;
  title?: ReactNode;
  eyebrow?: string;
  description?: string;
}

const STEP_THEME: Record<'red' | 'blue' | 'navy', string> = {
  red: 'bg-brand-accent-soft text-brand-accent',
  blue: 'bg-brand-soft text-brand',
  navy: 'bg-foreground/5 text-foreground',
};

/** Landing “Slik fungerer det” — responsive numbered steps. */
export default function HowItWorks({
  features,
  className,
  title,
  eyebrow = 'Slik fungerer det',
  description = HOW_IT_WORKS_DESCRIPTION,
}: HowItWorksProps = {}) {
  const data = features && features.length > 0 ? features : HOW_IT_WORKS_STEPS;

  return (
    <div className={cn('relative w-full px-4 py-14 sm:px-8 sm:py-16 md:py-20', className)}>
      <div className="relative z-10 mx-auto mb-10 max-w-2xl text-center md:mb-14">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent">{eyebrow}</p>
        {typeof title === 'string' || title == null ? (
          <HighlightPhrase
            text={typeof title === 'string' ? title : HOW_IT_WORKS_TITLE}
            highlight={HOW_IT_WORKS_KEYWORD}
            as="h2"
            className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl"
          />
        ) : (
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {title}
          </h2>
        )}
        <LandingHeadingRule className="landing-heading-rule--center" />
        <p className="mt-3 text-muted-foreground">{description}</p>
      </div>

      <ol className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        {data.map((step, index) => {
          const theme = STEP_THEME[step.colorTheme ?? 'blue'];
          return (
            <li key={step.title} className="min-w-0">
              <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-bold tabular-nums',
                      theme,
                    )}
                    aria-hidden
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="h-px flex-1 bg-border" aria-hidden />
                </div>
                <h3 className="mt-5 text-lg font-semibold leading-snug text-foreground sm:text-xl">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
