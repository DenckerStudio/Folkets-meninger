import type { SporsmalType } from '@/lib/stortinget';
import type { PolitikerOversikt } from '@/lib/stortinget';
import { getServiceSupabase } from '@/lib/supabase';
import { getSporsmalListe } from '@/lib/stortinget';
import {
  formatSporsmalDate,
  getSporsmalEmner,
  getSporsmalFraNavn,
  getSporsmalTitle,
  type StortingetSporsmal,
} from '@/lib/stortinget-sporsmal';
import { sporsmalTypeLabel } from '@/lib/stortinget-sporsmal';
import { STORTINGET_ACTIVE_SESSION_ID } from '@/lib/stortinget-config';

export type PolitikerSakRole = 'forslagstiller' | 'saksordfoerer';

export type PolitikerSakItem = {
  id: string;
  title: string;
  category: string | null;
  sakKind: string | null;
  status: string;
  role: PolitikerSakRole;
};

export type PolitikerTopicStat = {
  name: string;
  count: number;
};

export type PolitikerOfficialResponse = {
  id: string;
  stortingetIssueId: string;
  issueTitle: string | null;
  content: string;
  publishedAt: string;
};

export type PolitikerSporsmalItem = {
  id: string;
  title: string;
  type: SporsmalType;
  typeLabel: string;
  date: string | null;
  status: string | null;
  emner: string[];
  direction: 'fra' | 'til';
  counterparty: string | null;
};

export type PolitikerProfileData = {
  broughtUpSaker: PolitikerSakItem[];
  saksordfoererSaker: PolitikerSakItem[];
  topicStats: PolitikerTopicStat[];
  officialResponses: PolitikerOfficialResponse[];
  sporsmalFra: PolitikerSporsmalItem[];
  sporsmalTil: PolitikerSporsmalItem[];
  isPlatformVerified: boolean;
};

type PolitikerSakRow = {
  id: string;
  title: string;
  category: string | null;
  sak_kind: string | null;
  status: string;
  role: PolitikerSakRole;
};

function buildTopicStats(saker: PolitikerSakItem[]): PolitikerTopicStat[] {
  const counts = new Map<string, number>();
  for (const sak of saker) {
    const key = sak.category?.trim() || 'Ukjent tema';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'no'));
}

function ministerSporsmalTitle(rep: PolitikerOversikt): string | null {
  if (!rep.erRegjeringsmedlem) return null;
  const raw = (rep.tittel || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'statsminister') return 'statsministeren';
  if (raw.endsWith('minister')) return `${raw}en`;
  return null;
}

function mapSporsmalItem(
  item: StortingetSporsmal,
  type: SporsmalType,
  direction: 'fra' | 'til',
  counterparty: string | null,
): PolitikerSporsmalItem | null {
  if (!item.id) return null;
  return {
    id: String(item.id),
    title: getSporsmalTitle(item),
    type,
    typeLabel: sporsmalTypeLabel(type),
    date: formatSporsmalDate(item.sendt_dato || item.datert_dato),
    status: item.status != null ? String(item.status) : null,
    emner: getSporsmalEmner(item),
    direction,
    counterparty,
  };
}

async function getPolitikerSakerFromCache(personId: string): Promise<PolitikerSakItem[]> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('get_politiker_saker_from_cache', {
    p_stortinget_rep_id: personId,
  });

  if (error) {
    console.error('get_politiker_saker_from_cache failed:', error);
    return [];
  }

  return ((data as PolitikerSakRow[] | null) ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    sakKind: row.sak_kind,
    status: row.status,
    role: row.role,
  }));
}

async function getOfficialResponses(stortingetRepId: string): Promise<PolitikerOfficialResponse[]> {
  const service = getServiceSupabase();

  const { data: profile } = await service
    .from('politician_profiles')
    .select('id')
    .eq('stortinget_rep_id', stortingetRepId)
    .maybeSingle();

  if (!profile) return [];

  const { data: responses, error } = await service
    .from('politician_responses')
    .select('id, stortinget_issue_id, content, published_at')
    .eq('politician_profile_id', profile.id)
    .order('published_at', { ascending: false })
    .limit(20);

  if (error || !responses?.length) return [];

  const issueIds = responses.map((r) => r.stortinget_issue_id);
  const { data: issues } = await service
    .from('stortinget_issues')
    .select('id, title')
    .in('id', issueIds);

  const titleById = new Map((issues ?? []).map((issue) => [issue.id, issue.title]));

  return responses.map((response) => ({
    id: response.id,
    stortingetIssueId: response.stortinget_issue_id,
    issueTitle: titleById.get(response.stortinget_issue_id) ?? null,
    content: response.content,
    publishedAt: response.published_at,
  }));
}

async function getPolitikerSporsmal(
  personId: string,
  rep: PolitikerOversikt,
): Promise<{ fra: PolitikerSporsmalItem[]; til: PolitikerSporsmalItem[] }> {
  const types: SporsmalType[] = ['skriftligesporsmal', 'sporretimesporsmal', 'interpellasjoner'];
  const ministerTitle = ministerSporsmalTitle(rep);

  const lists = await Promise.all(
    types.map(async (type) => ({
      type,
      items: await getSporsmalListe({ type, sesjonId: STORTINGET_ACTIVE_SESSION_ID, nextRevalidateSeconds: 3600 }),
    })),
  );

  const fra: PolitikerSporsmalItem[] = [];
  const til: PolitikerSporsmalItem[] = [];

  for (const { type, items } of lists) {
    for (const raw of items) {
      const item = raw as StortingetSporsmal;
      const fraId = item.sporsmal_fra?.id;
      if (fraId && String(fraId) === personId) {
        const mapped = mapSporsmalItem(item, type, 'fra', item.sporsmal_til_minister_tittel ?? null);
        if (mapped) fra.push(mapped);
      }

      if (ministerTitle && item.sporsmal_til_minister_tittel?.toLowerCase() === ministerTitle) {
        const mapped = mapSporsmalItem(
          item,
          type,
          'til',
          getSporsmalFraNavn(item) ?? item.sporsmal_fra?.parti?.navn ?? null,
        );
        if (mapped) til.push(mapped);
      }
    }
  }

  const sortByDate = (a: PolitikerSporsmalItem, b: PolitikerSporsmalItem) =>
    (b.date ?? '').localeCompare(a.date ?? '', 'no');

  return {
    fra: fra.sort(sortByDate).slice(0, 15),
    til: til.sort(sortByDate).slice(0, 15),
  };
}

async function isPolitikerPlatformVerified(stortingetRepId: string): Promise<boolean> {
  const service = getServiceSupabase();
  const { data } = await service
    .from('politician_profiles')
    .select('id')
    .eq('stortinget_rep_id', stortingetRepId)
    .maybeSingle();
  return Boolean(data);
}

export async function getPolitikerProfileData(
  personId: string,
  rep: PolitikerOversikt,
): Promise<PolitikerProfileData> {
  const [saker, officialResponses, sporsmal, isPlatformVerified] = await Promise.all([
    getPolitikerSakerFromCache(personId),
    getOfficialResponses(personId),
    getPolitikerSporsmal(personId, rep),
    isPolitikerPlatformVerified(personId),
  ]);

  const broughtUpSaker = saker.filter((s) => s.role === 'forslagstiller');
  const saksordfoererSaker = saker.filter((s) => s.role === 'saksordfoerer');
  const topicStats = buildTopicStats(saker);

  return {
    broughtUpSaker,
    saksordfoererSaker,
    topicStats,
    officialResponses,
    sporsmalFra: sporsmal.fra,
    sporsmalTil: sporsmal.til,
    isPlatformVerified,
  };
}
