'use client';

import { LandingHeadingRule } from '@/components/icons/civic';
import { pollBallotRunningTextPhrase } from '@/lib/polls/ballot-buttons';
import { cn } from '@/lib/utils';

const BALLOT_RUNNING_TEXT = pollBallotRunningTextPhrase();

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

export interface StepPosition {
  className?: string;
  rotate?: string;
}

export interface HowItWorksProps {
  features?: Step[];
  className?: string;
  stepPositions?: StepPosition[];
  title?: string;
  eyebrow?: string;
  description?: string;
}

const STEP_THEME: Record<'red' | 'blue' | 'navy', string> = {
  red: 'bg-brand-accent-soft text-brand-accent',
  blue: 'bg-brand-soft text-brand',
  navy: 'bg-foreground/5 text-foreground',
};

const DEFAULT_FEATURES: Step[] = [
  {
    title: 'Direkte fra Stortinget',
    description:
      'Lovforslag og representantforslag hentes ufiltrert fra Stortingets åpne API — kildedokumentene bak avstemningene.',
    colorTheme: 'red',
  },
  {
    title: `Stem ${BALLOT_RUNNING_TEXT}`,
    description:
      `Nasjonale spørsmål bruker ${BALLOT_RUNNING_TEXT}. Stemmen telles uten navn i samlet statistikk.`,
    colorTheme: 'blue',
  },
  {
    title: 'Delta i debatten',
    description:
      'Høringer med navngitte innspill — del mening med fornavn og etternavn.',
    colorTheme: 'navy',
  },
  {
    title: 'Innsikt for politikere',
    description:
      'Anonymisert statistikk hjelper representanter å forstå hva velgerne faktisk mener.',
    colorTheme: 'red',
  },
];

/** Landing “Slik fungerer det” — responsive numbered steps. */
export default function HowItWorks({
  features,
  className,
  title = 'Fra Stortinget til din stemme',
  eyebrow = 'Slik fungerer det',
  description = 'Data fra Stortinget. Stem, høring og innsikt.',
}: HowItWorksProps = {}) {
  const data = features && features.length > 0 ? features : DEFAULT_FEATURES;

  return (
    <div className={cn('relative w-full px-4 py-14 sm:px-8 sm:py-16 md:py-20', className)}>
      <div className="relative z-10 mx-auto mb-10 max-w-2xl text-center md:mb-14">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">{eyebrow}</p>
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
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
