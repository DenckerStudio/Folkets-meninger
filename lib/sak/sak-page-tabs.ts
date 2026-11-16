export const SAK_PAGE_TAB_IDS = [
  'oversikt',
  'argumenter',
  'dokumenter',
  'stortinget',
  'diskusjon',
  'konsekvens',
] as const;

export type SakPageTabId = (typeof SAK_PAGE_TAB_IDS)[number];

const LEGACY_HASH_TO_TAB: Record<string, SakPageTabId> = {
  oversikt: 'oversikt',
  dokumenter: 'dokumenter',
  'for-deg': 'konsekvens',
  diskusjon: 'diskusjon',
  argumenter: 'argumenter',
  stortinget: 'stortinget',
  konsekvens: 'konsekvens',
};

export const SAK_PAGE_TAB_LABELS: Record<SakPageTabId, string> = {
  oversikt: 'Oversikt',
  argumenter: 'Argumenter',
  dokumenter: 'Dokumenter',
  stortinget: 'Stortinget',
  diskusjon: 'Diskusjon',
  konsekvens: 'Konsekvens',
};

function isSakPageTabId(value: string): value is SakPageTabId {
  return (SAK_PAGE_TAB_IDS as readonly string[]).includes(value);
}

/** Server-safe: read `?fane=` from search params. */
export function parseSakPageTabParam(
  value: string | string[] | undefined,
): SakPageTabId {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (trimmed && isSakPageTabId(trimmed)) return trimmed;
  return 'oversikt';
}

/** Client-only legacy `#dokumenter` etc. */
export function sakPageTabFromLocationHash(hash: string): SakPageTabId | null {
  const id = hash.replace(/^#/, '').trim().toLowerCase();
  if (!id) return null;
  return LEGACY_HASH_TO_TAB[id] ?? (isSakPageTabId(id) ? id : null);
}

export function sakPageTabHref(
  sakPath: string,
  tabId: SakPageTabId,
  extraQuery?: Record<string, string | undefined>,
): string {
  const url = new URL(sakPath, 'https://www.folkets-meninger.no');
  if (tabId !== 'oversikt') {
    url.searchParams.set('fane', tabId);
  } else {
    url.searchParams.delete('fane');
  }
  for (const [key, val] of Object.entries(extraQuery ?? {})) {
    if (val != null && val !== '') url.searchParams.set(key, val);
    else url.searchParams.delete(key);
  }
  return `${url.pathname}${url.search}`;
}