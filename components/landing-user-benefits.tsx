'use client';

import { HighlightPhrase } from '@/components/ui/highlight-phrase';
import {
  LANDING_BENEFITS_LINES,
} from '@/lib/landing/homepage-copy';

export function LandingUserBenefits() {
  return (
    <ul className="space-y-5 sm:space-y-6">
      {LANDING_BENEFITS_LINES.map((line) => (
        <li key={line.text}>
          <HighlightPhrase
            text={line.text}
            highlight={line.highlight}
            as="p"
            className="text-pretty text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl"
          />
        </li>
      ))}
    </ul>
  );
}
