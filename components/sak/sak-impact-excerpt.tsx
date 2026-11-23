'use client';

import Link from 'next/link';
import { Calculator } from 'lucide-react';
import { SAK_META_TOOLTIPS } from '@/lib/stortinget-sak-tooltips';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { useSakTooltipsEnabled } from '@/components/theme-provider';
import { sakPageTabHref } from '@/lib/sak/sak-page-tabs';
import { routes } from '@/lib/routes';

export function SakImpactExcerpt({ sakId }: { sakId: string }) {
  const showTooltips = useSakTooltipsEnabled();
  const href = sakPageTabHref(routes.sak(sakId), 'konsekvens');

  return (
    <section
      id="sak-oversikt-konsekvens"
      className="scroll-mt-below-sak-tabs rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
      aria-labelledby="sak-impact-excerpt-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="sak-impact-excerpt-heading" className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Calculator className="h-5 w-5 text-brand" aria-hidden />
          Konsekvenser for deg
          {showTooltips ? (
            <InfoTooltip
              label="konsekvens-kalkulatoren"
              description={SAK_META_TOOLTIPS.konsekvensKalkulator}
              side="bottom"
            />
          ) : null}
        </h2>
        <Link
          href={href}
          className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          Åpne konsekvenskalkulator
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Estimer hvordan saken kan påvirke økonomi og hverdag ut fra anonyme valg du gjør — uten å lagre noe på
        serveren.
      </p>
    </section>
  );
}