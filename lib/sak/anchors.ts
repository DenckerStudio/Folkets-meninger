import type { SakPageTabId } from '@/lib/sak/sak-page-tabs';

export const SAK_OVERSIKT_INNSTILLING_ANCHOR_ID = 'sak-oversikt-innstilling';
export const SAK_ARGUMENTER_SECTION_ANCHOR_ID = 'sak-argumenter';
export const SAK_TITTEL_ANCHOR_ID = 'sak-tittel';
export const SAK_OFFISIELL_BESKRIVELSE_ANCHOR_ID = 'sak-offisiell-beskrivelse';

export function sakPageTabPanelId(tabId: SakPageTabId): string {
  return `sak-fane-${tabId}`;
}

export function sakDocumentListAnchorId(documentId: string): string {
  return `sak-dokument-liste-${documentId}`;
}

export function sakDocumentShortlistAnchorId(documentId: string): string {
  return `sak-dokument-kort-${documentId}`;
}

export function sakOpinionAnchorId(opinionId: string): string {
  return `sak-mening-${opinionId}`;
}

export function sakDocumentTabHref(sakId: string, documentId: string): string {
  return `/dashboard/sak/${encodeURIComponent(sakId)}?fane=dokumenter&dokument=${encodeURIComponent(documentId)}#dokumenter`;
}