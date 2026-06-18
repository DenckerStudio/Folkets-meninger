import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from './supabase';
import {
  isDebattSak,
  mapSakPresentation,
  getSakKindLabel,
  type SakKind,
} from './stortinget-sak-presentation';
import { resolveSakTreatmentStatus, type SakTreatmentStatus } from './sak-status';
import { parseStortingetDotNetDateToISO, stortingetUrl, type StortingetFormat } from './stortinget-utils';
import { STORTINGET_ACTIVE_SESSION_ID } from './stortinget-config';
import type { SakListItem, SakVoteTotals, StortingetSak } from './stortinget';

const EMPTY_VOTES: SakVoteTotals = { for: 0, against: 0, abstain: 0, total: 0 };
const LIST_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MIN_DB_LIST_COUNT = 10;
const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000;

let memoryListCache: { items: SakListItem[]; expiresAt: number } | null = null;

function readMemoryListCache(): SakListItem[] | null {
  if (!memoryListCache || memoryListCache.expiresAt <= Date.now()) {
    return null;
  }
  return memoryListCache.items;
}

function writeMemoryListCache(items: SakListItem[]) {
  if (items.length === 0) return;
  memoryListCache = {
    items,
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
  };
}

function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

function canRefreshFromStortingetApi(): boolean {
  return !isProductionBuild();
}

type DbIssueRow = {
  id: string;
  title: string | null;
  summary: string | null;
  status: string | null;
  ferdigbehandlet: boolean | null;
  voting_closes_at: string | null;
  last_updated_at: string | null;
  last_synced_at: string | null;
  sak_kind: SakKind | null;
  henvisning: string | null;
  dokumentgruppe: number | null;
  category: string | null;
};

function mapStortingetSakToListItem(sak: StortingetSak, votes: SakVoteTotals = EMPTY_VOTES): SakListItem {
  const presentation = mapSakPresentation({
    korttittel: sak.korttittel,
    tittel: sak.tittel,
    henvisning: sak.henvisning,
    dokumentgruppe: sak.dokumentgruppe,
    emneNavn: sak.emne_liste?.[0]?.navn,
  });

  return {
    id: sak.id.toString(),
    title: presentation.title || sak.korttittel || sak.tittel || `Sak ${sak.id}`,
    summary: presentation.summary,
    category: presentation.category,
    date: parseStortingetDotNetDateToISO(sak.sist_oppdatert_dato),
    votes,
    status: resolveSakTreatmentStatus({ numericStatus: sak.status }),
    sakKind: presentation.kind,
    henvisning: presentation.henvisning,
    dokumentgruppe: sak.dokumentgruppe ?? null,
    votingOpen: true,
    votingDaysLeft: null,
  };
}

function resolveRowTreatmentStatus(row: DbIssueRow): SakTreatmentStatus {
  if (typeof row.ferdigbehandlet === 'boolean') {
    return resolveSakTreatmentStatus({ ferdigbehandlet: row.ferdigbehandlet });
  }
  if (row.status === 'closed' || row.status === 'pending') {
    return row.status;
  }
  return 'pending';
}

function resolveRowVotingState(row: DbIssueRow, status: SakTreatmentStatus) {
  let votingOpen = status !== 'closed';
  let votingDaysLeft: number | null = null;

  if (row.voting_closes_at) {
    const closesMs = new Date(row.voting_closes_at).getTime();
    if (closesMs <= Date.now()) {
      votingOpen = false;
      votingDaysLeft = 0;
    } else if (status !== 'closed') {
      votingOpen = true;
      votingDaysLeft = Math.max(1, Math.ceil((closesMs - Date.now()) / 86_400_000));
    }
  }

  return { votingOpen, votingDaysLeft };
}

function mapDbRowToListItem(row: DbIssueRow, votes: SakVoteTotals = EMPTY_VOTES): SakListItem {
  const status = resolveRowTreatmentStatus(row);
  const { votingOpen, votingDaysLeft } = resolveRowVotingState(row, status);
  const category =
    row.category?.trim() ||
    (row.sak_kind ? getSakKindLabel(row.sak_kind) : 'Generelt');

  return {
    id: row.id,
    title: row.title || `Sak ${row.id}`,
    summary: row.summary || '',
    category,
    date: row.last_updated_at?.split('T')[0] ?? '',
    votes,
    status,
    sakKind: row.sak_kind,
    henvisning: row.henvisning,
    dokumentgruppe: row.dokumentgruppe,
    votingOpen,
    votingDaysLeft,
  };
}

async function getCachedIssueOverlays(
  issueIds: string[],
): Promise<
  Record<
    string,
    {
      status: SakTreatmentStatus;
      votingDaysLeft: number | null;
      votingOpen: boolean;
      lastUpdatedAt: string | null;
    }
  >
> {
  const result: Record<
    string,
    {
      status: SakTreatmentStatus;
      votingDaysLeft: number | null;
      votingOpen: boolean;
      lastUpdatedAt: string | null;
    }
  > = {};

  if (issueIds.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return result;
  }

  try {
    const service = getServiceSupabase();
    const chunkSize = 200;
    const now = Date.now();

    for (let i = 0; i < issueIds.length; i += chunkSize) {
      const chunk = issueIds.slice(i, i + chunkSize);
      const { data, error } = await service
        .from('stortinget_issues')
        .select('id, status, ferdigbehandlet, voting_closes_at, last_updated_at')
        .in('id', chunk);

      if (error || !data) continue;

      for (const row of data) {
        const status =
          typeof row.ferdigbehandlet === 'boolean'
            ? resolveSakTreatmentStatus({ ferdigbehandlet: row.ferdigbehandlet })
            : row.status === 'closed' || row.status === 'pending'
              ? row.status
              : 'pending';

        let votingDaysLeft: number | null = null;
        let votingOpen = status !== 'closed';

        if (row.voting_closes_at) {
          const closesMs = new Date(row.voting_closes_at).getTime();
          if (closesMs <= now) {
            votingOpen = false;
            votingDaysLeft = 0;
          } else {
            votingOpen = status !== 'closed';
            votingDaysLeft = Math.max(1, Math.ceil((closesMs - now) / 86_400_000));
          }
        }

        result[String(row.id)] = {
          status,
          votingDaysLeft,
          votingOpen,
          lastUpdatedAt: row.last_updated_at ?? null,
        };
      }
    }
  } catch (e) {
    console.error('Failed to fetch cached issue overlays:', e);
  }

  return result;
}

function applyOverlaysToSaker(
  saker: SakListItem[],
  overlays: Awaited<ReturnType<typeof getCachedIssueOverlays>>,
) {
  for (const sak of saker) {
    const cached = overlays[sak.id];
    if (!cached) continue;
    sak.status = cached.status;
    sak.votingOpen = cached.votingOpen;
    sak.votingDaysLeft = cached.votingDaysLeft;
    if (!sak.date && cached.lastUpdatedAt) {
      sak.date = cached.lastUpdatedAt.split('T')[0];
    }
  }
}

async function enrichSakerList(saker: SakListItem[]): Promise<SakListItem[]> {
  const issueIds = saker.map((sak) => sak.id);
  const [overlays, voteTotals] = await Promise.all([
    getCachedIssueOverlays(issueIds),
    getVoteTotals(issueIds),
  ]);

  applyOverlaysToSaker(saker, overlays);

  for (const sak of saker) {
    if (voteTotals[sak.id]) {
      sak.votes = voteTotals[sak.id];
    }
  }

  return saker;
}

async function getVoteTotals(
  issueIds: string[],
): Promise<Record<string, SakVoteTotals>> {
  const result: Record<string, SakVoteTotals> = {};
  if (issueIds.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return result;
  }

  try {
    const service = getServiceSupabase();
    const { data, error } = await service.rpc('get_vote_totals_batch', {
      p_issue_ids: issueIds,
    });

    if (error || !data || typeof data !== 'object') {
      return result;
    }

    const batch = data as Record<string, { for?: number; against?: number; abstain?: number; total?: number }>;
    for (const [issueId, counts] of Object.entries(batch)) {
      const forCount = counts.for ?? 0;
      const againstCount = counts.against ?? 0;
      const abstainCount = counts.abstain ?? 0;
      result[issueId] = {
        for: forCount,
        against: againstCount,
        abstain: abstainCount,
        total: counts.total ?? forCount + againstCount + abstainCount,
      };
    }
  } catch (e) {
    console.error('Failed to fetch vote totals from Supabase:', e);
  }

  return result;
}

async function readSakerListFromDbUncached(): Promise<{ items: SakListItem[]; stale: boolean } | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const baseSelect =
    'id, title, summary, status, ferdigbehandlet, voting_closes_at, last_updated_at, last_synced_at, sak_kind, henvisning, dokumentgruppe';

  try {
    const service = getServiceSupabase();
    let data: DbIssueRow[] | null = null;
    let error: { message?: string } | null = null;

    const withCategory = await service
      .from('stortinget_issues')
      .select(`${baseSelect}, category`)
      .not('sak_kind', 'is', null)
      .order('last_updated_at', { ascending: false, nullsFirst: false });

    if (withCategory.error?.message?.includes('category')) {
      const withoutCategory = await service
        .from('stortinget_issues')
        .select(baseSelect)
        .not('sak_kind', 'is', null)
        .order('last_updated_at', { ascending: false, nullsFirst: false });
      data = (withoutCategory.data as DbIssueRow[] | null) ?? null;
      error = withoutCategory.error;
    } else {
      data = (withCategory.data as DbIssueRow[] | null) ?? null;
      error = withCategory.error;
    }

    if (error || !data || data.length < MIN_DB_LIST_COUNT) {
      return null;
    }

    const rows = data as DbIssueRow[];
    const latestSync = rows.reduce((max, row) => {
      const syncedAt = row.last_synced_at ? new Date(row.last_synced_at).getTime() : 0;
      return Math.max(max, syncedAt);
    }, 0);
    const stale = latestSync === 0 || Date.now() - latestSync > LIST_CACHE_MAX_AGE_MS;

    const voteTotals = await getVoteTotals(rows.map((row) => row.id));
    const items = rows.map((row) => mapDbRowToListItem(row, voteTotals[row.id] ?? EMPTY_VOTES));

    return { items, stale };
  } catch (e) {
    console.error('Failed to read saker list from DB:', e);
    return null;
  }
}

async function readSakerListFromDb(): Promise<{ items: SakListItem[]; stale: boolean } | null> {
  if (isProductionBuild()) {
    return null;
  }

  return withTimeout(readSakerListFromDbUncached(), 12_000, null);
}

const getCachedSakerListFromDb = unstable_cache(
  async () => readSakerListFromDb(),
  ['stortinget-saker-db-list'],
  { revalidate: 300, tags: ['stortinget-saker'] },
);

async function fetchRawSakerFromStortinget(): Promise<StortingetSak[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(
      stortingetUrl('/eksport/saker', {
        stortingssesjonid: STORTINGET_ACTIVE_SESSION_ID,
        format: 'json' satisfies StortingetFormat,
      }),
      { cache: 'no-store', signal: controller.signal },
    );

    if (!res.ok) {
      throw new Error('Failed to fetch saker from Stortinget');
    }

    const data = (await res.json()) as { saker_liste?: StortingetSak[] };
    return data.saker_liste ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function persistSakerListToDb(items: SakListItem[]): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || items.length === 0) {
    return;
  }

  const service = getServiceSupabase();
  const now = new Date().toISOString();
  const chunkSize = 100;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const { error } = await service.from('stortinget_issues').upsert(
      chunk.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary || null,
        status: item.status,
        category: item.category || null,
        sak_kind: item.sakKind,
        henvisning: item.henvisning,
        dokumentgruppe: item.dokumentgruppe,
        last_synced_at: now,
        last_updated_at: item.date ? `${item.date}T00:00:00.000Z` : now,
      })),
      { onConflict: 'id' },
    );

    if (error) {
      console.error('persistSakerListToDb chunk error:', error);
    }
  }
}

let refreshInFlight: Promise<SakListItem[] | null> | null = null;

export async function refreshSakerListFromStortinget(opts?: {
  includeAll?: boolean;
}): Promise<SakListItem[] | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const rawSaker = await fetchRawSakerFromStortinget();
      const filtered = opts?.includeAll
        ? rawSaker
        : rawSaker.filter((sak) =>
            isDebattSak({
              korttittel: sak.korttittel,
              tittel: sak.tittel,
              henvisning: sak.henvisning,
              dokumentgruppe: sak.dokumentgruppe,
            }),
          );

      const saker = filtered.map((sak) => mapStortingetSakToListItem(sak));
      await enrichSakerList(saker);
      await persistSakerListToDb(saker);
      return saker;
    } catch (error) {
      console.error('refreshSakerListFromStortinget error:', error);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export type GetSakerCacheOpts = {
  includeAll?: boolean;
  preferDb?: boolean;
  forceRefresh?: boolean;
};

function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

async function queryPopularRowsFromDb(): Promise<DbIssueRow[]> {
  const service = getServiceSupabase();
  const baseSelect =
    'id, title, summary, status, ferdigbehandlet, voting_closes_at, last_updated_at, last_synced_at, sak_kind, henvisning, dokumentgruppe';

  const withCategory = await service
    .from('stortinget_issues')
    .select(`${baseSelect}, category`)
    .not('sak_kind', 'is', null)
    .order('last_updated_at', { ascending: false, nullsFirst: false })
    .limit(60);

  if (withCategory.error?.message?.includes('category')) {
    const withoutCategory = await service
      .from('stortinget_issues')
      .select(baseSelect)
      .not('sak_kind', 'is', null)
      .order('last_updated_at', { ascending: false, nullsFirst: false })
      .limit(60);
    return (withoutCategory.data as DbIssueRow[] | null) ?? [];
  }

  if (withCategory.error) {
    return [];
  }

  return (withCategory.data as DbIssueRow[] | null) ?? [];
}

export async function getPopularSaker(limit = 10): Promise<SakListItem[]> {
  const cappedLimit = Math.min(Math.max(limit, 1), 20);
  const memory = readMemoryListCache();
  if (memory) {
    return [...memory]
      .sort((a, b) => (b.votes?.total ?? 0) - (a.votes?.total ?? 0))
      .slice(0, cappedLimit);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  try {
    const rows = await withTimeout(queryPopularRowsFromDb(), 8_000, []);
    if (rows.length === 0) {
      return [];
    }

    const voteTotals = await withTimeout(getVoteTotals(rows.map((row) => row.id)), 8_000, {});
    const popular = rows
      .map((row) => mapDbRowToListItem(row, voteTotals[row.id] ?? EMPTY_VOTES))
      .sort((a, b) => (b.votes?.total ?? 0) - (a.votes?.total ?? 0))
      .slice(0, cappedLimit);

    writeMemoryListCache(popular);
    return popular;
  } catch (error) {
    console.error('getPopularSaker error:', error);
    return [];
  }
}

export async function getSakerWithCache(opts?: GetSakerCacheOpts): Promise<SakListItem[]> {
  if (isProductionBuild()) {
    return [];
  }

  const preferDb = opts?.preferDb !== false;

  if (!opts?.forceRefresh) {
    const memory = readMemoryListCache();
    if (memory) {
      return memory;
    }
  }

  if (!opts?.forceRefresh && preferDb) {
    const cached = await getCachedSakerListFromDb();
    if (cached?.items.length) {
      writeMemoryListCache(cached.items);
      if (cached.stale && canRefreshFromStortingetApi()) {
        void refreshSakerListFromStortinget({ includeAll: opts?.includeAll }).then((items) => {
          if (items?.length) writeMemoryListCache(items);
        });
      }
      return cached.items;
    }
  }

  if (!canRefreshFromStortingetApi()) {
    const fallback = await getCachedSakerListFromDb();
    const items = fallback?.items ?? [];
    writeMemoryListCache(items);
    return items;
  }

  const refreshed = await refreshSakerListFromStortinget({ includeAll: opts?.includeAll });
  if (refreshed?.length) {
    writeMemoryListCache(refreshed);
    return refreshed;
  }

  const fallback = await readSakerListFromDb();
  const items = fallback?.items ?? [];
  writeMemoryListCache(items);
  return items;
}
