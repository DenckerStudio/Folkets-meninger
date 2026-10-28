'use client';

import { useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { UTEN_KONTEKST_BADGE_HINT } from '@/lib/admin/uten-kontekst';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

export function UtenKontekstBadge({ className }: Props) {
  const hintId = useId();

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-700/45 bg-background px-2.5 py-1 text-xs font-medium text-amber-900 dark:border-amber-500/50 dark:text-amber-200',
        className,
      )}
      aria-describedby={hintId}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Uten kontekst</span>
      <span id={hintId} className="sr-only">
        {UTEN_KONTEKST_BADGE_HINT}
      </span>
      <InfoTooltip label="Uten kontekst" description={UTEN_KONTEKST_BADGE_HINT} side="bottom" align="center" />
    </span>
  );
}
