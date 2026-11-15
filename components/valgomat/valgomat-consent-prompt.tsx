'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PoliticalConsentDialog } from '@/components/consent/political-consent-dialog';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type ValgomatConsentPromptProps = {
  onConsented: () => void;
  compact?: boolean;
};

export function ValgomatConsentPrompt({ onConsented, compact = false }: ValgomatConsentPromptProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <aside
        className={cn(
          'rounded-xl border border-border bg-muted/30',
          compact ? 'space-y-3 p-4 text-center' : 'space-y-4 p-6',
        )}
        aria-labelledby="valgomat-consent-heading"
      >
        <h2
          id="valgomat-consent-heading"
          className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}
        >
          Samtykke kreves for Valgomat
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Valgomat og partisamsvar bruker dine lagrede holdninger. Du må gi samtykke til lagring og
          profilering (valgomat/partimatch) før vi kan vise resultatene.
        </p>
        <div
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center',
            compact && 'items-center',
          )}
        >
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className={cn(
              'min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-white',
              'hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
            )}
          >
            Gi samtykke
          </button>
          <Link
            href={`${routes.minSide}?tab=min-data`}
            className={cn(
              'inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground',
              'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
            )}
          >
            Personverninnstillinger
          </Link>
        </div>
      </aside>
      <PoliticalConsentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        requireProfiling
        onAccepted={() => {
          setDialogOpen(false);
          onConsented();
        }}
      />
    </>
  );
}