/** Nøytrale admin-etiketter for kilde- og korpustyper (ikke Reddit-navn i UI). */

export function adminRagCorpusLabel(corpus: string): string {
  switch (corpus) {
    case 'høring':
      return 'Høring';
    case 'stortinget_sak':
      return 'Stortinget-sak';
    default:
      return corpus || 'Ukjent';
  }
}

export function adminRagDocumentTypeLabel(sourceType: string): string {
  const t = sourceType.trim().toLowerCase();
  if (!t || t === 'ukjent') return 'Ukjent dokumenttype';
  if (t === 'høring') return 'Høringsdokument';
  return sourceType;
}

export function adminCaptureSourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case 'news_rss':
      return 'Nyhets-RSS';
    case 'reddit':
      return 'Sosialt signal';
    case 'petition':
      return 'Opprop';
    case 'searxng':
      return 'Nettsøk';
    case 'ukjent':
      return 'Ukjent';
    default:
      return sourceType;
  }
}