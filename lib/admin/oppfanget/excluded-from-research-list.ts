import type { ActionTypeDb } from '@/lib/admin/oppfanget/types';

/** Aksjonstyper fra fangst-pipeline som ikke vises på Research-listen (data beholdes). */
export const OPPFANGET_ACTION_TYPES_EXCLUDED_FROM_RESEARCH_LIST: readonly ActionTypeDb[] = [
  'opprop',
  'demonstrasjon',
  'innsamling',
  'boykott',
  'kampanje',
];
