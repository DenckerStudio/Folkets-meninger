import {
  SAK_DOCUMENT_KIND_LABELS,
  type SakDocumentKind,
  type SakDocumentRef,
} from '@/lib/stortinget-documents';
import { rewriteDottedDatesForDisplay } from '@/lib/sak/date-format';

export const SAK_DOCUMENT_FILTER_ALL = 'alle' as const;
export type SakDocumentFilterValue = SakDocumentKind | typeof SAK_DOCUMENT_FILTER_ALL;

export const SAK_DOCUMENT_FILTER_OPTIONS: { value: SakDocumentFilterValue; label: string }[] = [
  { value: SAK_DOCUMENT_FILTER_ALL, label: 'Alle typer' },
  ...(Object.entries(SAK_DOCUMENT_KIND_LABELS) as [SakDocumentKind, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

/** Tittel slik brukeren ser den: «Stortingsreferat 09.04.2026» → «Stortingsreferat 9. april 2026». Lagret tittel endres ikke. */
export function sakDocumentDisplayTitle(title: string): string {
  return rewriteDottedDatesForDisplay(title);
}

export function filterSakDocumentsByKind<T extends Pick<SakDocumentRef, 'kind'>>(
  documents: readonly T[],
  filter: SakDocumentFilterValue,
): T[] {
  if (filter === SAK_DOCUMENT_FILTER_ALL) return [...documents];
  return documents.filter((doc) => doc.kind === filter);
}

export function searchSakDocumentsByTitle<T extends Pick<SakDocumentRef, 'title'>>(
  documents: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...documents];
  return documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(q) ||
      sakDocumentDisplayTitle(doc.title).toLowerCase().includes(q),
  );
}

export function filterAndSearchSakDocuments<T extends Pick<SakDocumentRef, 'kind' | 'title'>>(
  documents: readonly T[],
  filter: SakDocumentFilterValue,
  query: string,
): T[] {
  return searchSakDocumentsByTitle(filterSakDocumentsByKind(documents, filter), query);
}

export function sakDocumentsLinkLabel(count: number): string {
  return count === 1 ? 'Se dokumentet på saken' : `Se alle ${count} dokumenter`;
}
