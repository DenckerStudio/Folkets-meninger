import type { OppfangetDisplayType, OppfangetRow } from '@/lib/admin/oppfanget/types';

/** Visningstyper for klassiske aksjonsfangst (skjules på Research; rader beholdes i DB). */
export const OPPFANGET_DISPLAY_TYPES_EXCLUDED_FROM_RESEARCH_LIST: readonly OppfangetDisplayType[] = [
  'opprop',
  'aksjon',
  'boikott',
];

/** Research-listen viser signaler («melding»), ikke opprop/demonstrasjon m.m. */
export function shouldIncludeOppfangetRowInResearchList(
  displayType: OppfangetDisplayType,
): boolean {
  return !OPPFANGET_DISPLAY_TYPES_EXCLUDED_FROM_RESEARCH_LIST.includes(displayType);
}

export function filterOppfangetRowsForResearchList(rows: OppfangetRow[]): OppfangetRow[] {
  return rows.filter((row) => shouldIncludeOppfangetRowInResearchList(row.displayType));
}
