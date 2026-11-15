import { routes } from '@/lib/routes';
import { MIN_PUBLIC_AGGREGATE_N } from '@/lib/public-aggregate/constants';

/** Shown when folk For/Mot/Avstår totals exist but are below the public floor. */
export function folkHistoricAggregateBelowThresholdMessage(): string {
  return `Fordelingen vises når minst ${MIN_PUBLIC_AGGREGATE_N} historiske anonyme stemmer finnes. Tallene er For/Mot/Avstår fra perioden før per-sak stemming på sakssiden ble avviklet.`;
}

export type FolkBelowThresholdNextStep =
  | { kind: 'poll'; href: string; label: string }
  | { kind: 'explore'; href: string; label: string };

export function folkBelowThresholdNextStep(openPollId: string | null | undefined): FolkBelowThresholdNextStep {
  const trimmed = typeof openPollId === 'string' ? openPollId.trim() : '';
  if (trimmed) {
    return {
      kind: 'poll',
      href: routes.poll(trimmed),
      label: 'Gå til avstemningen (Nei/Blank/Ja) →',
    };
  }
  return {
    kind: 'explore',
    href: routes.utforsk,
    label: 'Utforsk saker →',
  };
}