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
  return `/dashboard/sak/${encodeURIComponent(sakId)}?dokument=${encodeURIComponent(documentId)}#dokumenter`;
}