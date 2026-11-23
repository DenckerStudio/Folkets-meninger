export const SAK_OVERSIKT_RELATERT_ANCHOR_ID = 'sak-oversikt-relatert';

export type SakOversiktRelatertTocInput = {
  hasRelaterteSaker: boolean;
  similarShowsSection: boolean;
  hasTopicAround: boolean;
};

export function shouldShowSakOversiktRelatertAnchor(input: SakOversiktRelatertTocInput): boolean {
  return input.hasRelaterteSaker || input.similarShowsSection || input.hasTopicAround;
}

/** TOC-tekst som samsvarer med synlig overskrift når bare én underseksjon vises. */
export function sakOversiktRelatertTocLabel(input: SakOversiktRelatertTocInput): string | null {
  if (!shouldShowSakOversiktRelatertAnchor(input)) {
    return null;
  }

  const visibleKinds = [
    input.hasRelaterteSaker ? 'relaterte' as const : null,
    input.similarShowsSection ? 'liknende' as const : null,
    input.hasTopicAround ? 'tema' as const : null,
  ].filter((v): v is 'relaterte' | 'liknende' | 'tema' => v != null);

  if (visibleKinds.length === 1) {
    switch (visibleKinds[0]) {
      case 'relaterte':
        return 'Relaterte saker';
      case 'liknende':
        return 'Liknende saker';
      case 'tema':
        return 'Søk rundt temaet';
      default: {
        const _exhaustive: never = visibleKinds[0];
        return _exhaustive;
      }
    }
  }

  if (input.hasRelaterteSaker) {
    return 'Relaterte saker';
  }
  if (input.similarShowsSection) {
    return 'Liknende saker';
  }
  return 'Søk rundt temaet';
}

export function similarIssuesShowsInToc(input: {
  loadStatus: 'ok' | 'error';
  itemCount: number;
  clientLoading?: boolean;
}): boolean {
  if (input.clientLoading) return true;
  if (input.loadStatus === 'error') return true;
  return input.itemCount > 0;
}