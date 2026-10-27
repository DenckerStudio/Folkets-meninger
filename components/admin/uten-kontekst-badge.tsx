'use client';

import { cn } from '@/lib/utils';

const HINT = 'Laget uten kildetreff – sjekk fakta før publisering';

type Props = {
  className?: string;
};

export function UtenKontekstBadge({ className }: Props) {
  return (
    <span
      title={HINT}
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        'bg-amber-500/15 text-amber-800 dark:text-amber-300',
        className,
      )}
    >
      Uten kontekst
    </span>
  );
}
