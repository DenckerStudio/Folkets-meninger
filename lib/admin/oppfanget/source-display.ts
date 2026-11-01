import type { OppfangetSourceRow } from '@/lib/admin/oppfanget/types';

export function oppfangetSourceTypeLabel(sourceType: OppfangetSourceRow['sourceType']): string | null {
  switch (sourceType) {
    case 'reddit':
      return 'Reddit';
    case 'news_rss':
      return 'Nyhet';
    case 'petition':
      return 'Opprop';
    case 'searxng':
      return 'Søk';
    default:
      return null;
  }
}

export function formatOppfangetSourcePublisher(source: OppfangetSourceRow): string {
  const typeLabel = oppfangetSourceTypeLabel(source.sourceType);
  const base = source.publisher?.trim() || source.title?.trim() || 'Kilde';
  if (source.sourceType === 'reddit') {
    return base.toLowerCase().includes('reddit') ? base : `Reddit · ${base}`;
  }
  if (typeLabel && !base.toLowerCase().includes(typeLabel.toLowerCase())) {
    return `${typeLabel} · ${base}`;
  }
  return base;
}

export function sortOppfangetSources(sources: OppfangetSourceRow[]): OppfangetSourceRow[] {
  const rank = (s: OppfangetSourceRow): number => {
    if (s.signalOnly) return 3;
    switch (s.sourceType) {
      case 'news_rss':
        return 0;
      case 'petition':
        return 1;
      case 'reddit':
        return 2;
      case 'searxng':
        return 4;
      default:
        return 5;
    }
  };
  return sources.slice().sort((a, b) => rank(a) - rank(b) || a.url.localeCompare(b.url));
}
