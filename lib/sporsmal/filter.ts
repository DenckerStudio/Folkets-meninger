import {
  getSporsmalFraNavn,
  getSporsmalEmner,
  isSporsmalBesvart,
  type StortingetSporsmal,
} from '@/lib/stortinget-sporsmal';
import {
  getSporsmalPartyId,
  getSporsmalPartyName,
  getSporsmalFraId,
  getSporsmalSearchText,
} from '@/lib/sporsmal/search-text';
import { resolveSporsmalTheme, SPORSMAL_FALLBACK_THEME, type SporsmalThemeLabel } from '@/lib/sporsmal/themes';
import { parseStortingetDate } from '@/lib/stortinget-horinger';

export const SPORSMAL_PAGE_SIZE = 30;

export type SporsmalAnswerFilter = 'alle' | 'besvart' | 'ubesvart';

export type SporsmalFilterState = {
  query: string;
  theme: SporsmalThemeLabel | null;
  partyId: string | null;
  representativeId: string | null;
  answerFilter: SporsmalAnswerFilter;
};

export type SporsmalListItemView = StortingetSporsmal & {
  theme: SporsmalThemeLabel;
  sakId: string | null;
};

function matchesQuery(item: StortingetSporsmal, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    getSporsmalSearchText(item),
    getSporsmalFraNavn(item) ?? '',
    item.sporsmal_til_minister_tittel ?? '',
    getSporsmalEmner(item).join(' '),
    getSporsmalPartyName(item) ?? '',
  ]
    .join('\n')
    .toLowerCase();
  return haystack.includes(q);
}

export function filterSporsmalList(
  items: StortingetSporsmal[],
  state: SporsmalFilterState,
  sakById: Map<string, string | null>,
): SporsmalListItemView[] {
  return items
    .filter((item) => {
      if (!matchesQuery(item, state.query)) return false;

      if (state.answerFilter === 'besvart' && !isSporsmalBesvart(item)) return false;
      if (state.answerFilter === 'ubesvart' && isSporsmalBesvart(item)) return false;

      if (state.partyId) {
        const partyId = getSporsmalPartyId(item);
        if (!partyId || partyId !== state.partyId) return false;
      }

      if (state.representativeId) {
        const fraId = getSporsmalFraId(item);
        if (!fraId || fraId !== state.representativeId) return false;
      }

      if (state.theme) {
        const theme = resolveSporsmalTheme(item);
        if (theme !== state.theme) return false;
      }

      return true;
    })
    .map((item) => ({
      ...item,
      theme: resolveSporsmalTheme(item),
      sakId: sakById.get(String(item.id ?? '')) ?? null,
    }));
}

/** Milliseconds since epoch for default nyeste-først sorting. */
export function getSporsmalSortTime(item: StortingetSporsmal): number {
  const sent = parseStortingetDate(item.sendt_dato ? String(item.sendt_dato) : undefined);
  const dated = parseStortingetDate(item.datert_dato ? String(item.datert_dato) : undefined);
  const ms = sent?.getTime() ?? dated?.getTime() ?? 0;
  if (ms > 0) return ms;
  return item.sporsmal_nummer ?? 0;
}

/** Default list order: newest question first; tema is not a sort key. */
export function sortSporsmalForDisplay(items: SporsmalListItemView[]): SporsmalListItemView[] {
  return [...items].sort((a, b) => {
    const tA = getSporsmalSortTime(a);
    const tB = getSporsmalSortTime(b);
    if (tB !== tA) return tB - tA;
    const numA = a.sporsmal_nummer ?? 0;
    const numB = b.sporsmal_nummer ?? 0;
    if (numB !== numA) return numB - numA;
    return String(b.id ?? '').localeCompare(String(a.id ?? ''), 'nb');
  });
}

/** When rendering tema-grupper on a page, rank grupper by nyeste spørsmål — «Annet» sist. */
export function sortGroupedSporsmalThemes(
  groups: Array<[SporsmalThemeLabel, SporsmalListItemView[]]>,
): Array<[SporsmalThemeLabel, SporsmalListItemView[]]> {
  return [...groups].sort((a, b) => {
    const maxA = Math.max(0, ...a[1].map((item) => getSporsmalSortTime(item)));
    const maxB = Math.max(0, ...b[1].map((item) => getSporsmalSortTime(item)));
    if (maxB !== maxA) return maxB - maxA;
    if (a[0] === SPORSMAL_FALLBACK_THEME && b[0] !== SPORSMAL_FALLBACK_THEME) return 1;
    if (b[0] === SPORSMAL_FALLBACK_THEME && a[0] !== SPORSMAL_FALLBACK_THEME) return -1;
    return a[0].localeCompare(b[0], 'nb');
  });
}

export function paginateList<T>(items: T[], page: number, pageSize = SPORSMAL_PAGE_SIZE): {
  page: number;
  totalPages: number;
  items: T[];
} {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
}

export function countByTheme(items: SporsmalListItemView[]): Partial<Record<SporsmalThemeLabel, number>> {
  const counts: Partial<Record<SporsmalThemeLabel, number>> = {};
  for (const item of items) {
    counts[item.theme] = (counts[item.theme] ?? 0) + 1;
  }
  return counts;
}

export function uniqueParties(items: StortingetSporsmal[]): Array<{ id: string; name: string }> {
  const map = new Map<string, string>();
  for (const item of items) {
    const id = getSporsmalPartyId(item);
    const name = getSporsmalPartyName(item);
    if (id && name && !map.has(id)) {
      map.set(id, name);
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}

export function uniqueRepresentatives(
  items: StortingetSporsmal[],
  partyId: string | null,
): Array<{ id: string; name: string; partyName: string | null }> {
  const map = new Map<string, { id: string; name: string; partyName: string | null }>();
  for (const item of items) {
    const id = getSporsmalFraId(item);
    const name = getSporsmalFraNavn(item);
    if (!id || !name) continue;
    if (partyId && getSporsmalPartyId(item) !== partyId) continue;
    if (!map.has(id)) {
      map.set(id, { id, name, partyName: getSporsmalPartyName(item) });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}