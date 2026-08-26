import { STORTINGET_ACTIVE_PERIODE_ID, STORTINGET_ACTIVE_SESSION_ID } from './stortinget-config';
import {
  mapSakPresentation,
  type SakKind,
} from './stortinget-sak-presentation';
import {
  resolveSakListStatus,
  resolveSakStatusFromSources,
  type SakTreatmentStatus,
  type ListSakInnstillingFields,
} from './sak-status';
import { getSakVotingWindow } from './sak-voting-window';
import { parseStortingetDotNetDateToISO, stortingetUrl, type StortingetFormat } from './stortinget-utils';

export type { SakKind };

function getActiveSesjonId(): string {
  return STORTINGET_ACTIVE_SESSION_ID;
}

function getActiveStortingsperiodeId(): string {
  return STORTINGET_ACTIVE_PERIODE_ID;
}

export interface StortingetSak {
  id: number;
  tittel: string;
  korttittel: string;
  status: number;
  type?: number;
  dokumentgruppe?: number;
  innstilling_id?: number;
  innstilling_kode?: number;
  emne_liste?: { navn: string }[];
  sist_oppdatert_dato: string;
  henvisning: string;
  forslagstiller_liste?: Array<{ fornavn?: string; etternavn?: string; parti?: { navn?: string } }>;
}

export interface SakVoteTotals {
  for: number;
  against: number;
  abstain: number;
  total: number;
}

export interface SakListItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  votes: SakVoteTotals;
  status: SakTreatmentStatus;
  /** Raw `status` from Stortinget list/detail export; used to beat stale cached detail_json. */
  stortingetNumericStatus?: number;
  listInnstilling?: ListSakInnstillingFields;
  sakKind: SakKind | null;
  henvisning: string | null;
  dokumentgruppe: number | null;
  votingOpen: boolean;
  votingDaysLeft: number | null;
}

export interface StortingetSakDetail {
  id: number;
  tittel?: string;
  korttittel?: string;
  status?: number;
  ferdigbehandlet?: boolean;
  emne_liste?: { navn: string }[];
  sist_oppdatert_dato?: string;
  henvisning?: string;
  dokumentgruppe?: number;
  type?: number;
  sak_nummer?: string;
  sak_sesjon?: string;
  komite?: { navn?: string } | string;
  innstillingstekst?: string;
  kortvedtak?: string;
  vedtakstekst?: string;
  parentestekst?: string;
  saksgang?: {
    navn?: string;
    saksgang_steg_liste?: Array<{
      navn: string;
      saksgang_hendelse_liste?: Array<{
        id?: string;
        dato?: string;
        hendelse_tekst?: string;
      }>;
    }>;
  };
  sak_opphav?: { forslagstiller_liste?: Array<{ id?: string; fornavn?: string; etternavn?: string; parti?: { navn?: string } }> };
  saksordfoerer_liste?: Array<{ id?: string; fornavn?: string; etternavn?: string; parti?: { navn?: string } }>;
  stikkord_liste?: Array<{ navn?: string } | string>;
  sak_relasjon_liste?: Array<{
    sak_id?: number | string;
    id?: number | string;
    tittel?: string;
    korttittel?: string;
    relatert_sak?: { id: number; korttittel?: string; tittel?: string };
    relasjonstype?: string;
  }>;
  publikasjon_referanse_liste?: Array<{
    eksport_id?: string | null;
    lenke_tekst?: string | null;
    lenke_url?: string | null;
    type?: string | number | null;
    undertype?: string | null;
  }>;
  [key: string]: unknown;
}

const EMPTY_VOTES: SakVoteTotals = { for: 0, against: 0, abstain: 0, total: 0 };

function mapDetailToListItem(detail: StortingetSakDetail, votes: SakVoteTotals = EMPTY_VOTES): SakListItem {
  const presentation = mapSakPresentation({
    korttittel: detail.korttittel,
    tittel: detail.tittel,
    henvisning: detail.henvisning,
    dokumentgruppe: typeof detail.dokumentgruppe === 'number' ? detail.dokumentgruppe : null,
    emneNavn: detail.emne_liste?.[0]?.navn,
  });

  return {
    id: String(detail.id),
    title: presentation.title || detail.korttittel || detail.tittel || `Sak ${detail.id}`,
    summary: presentation.summary,
    category: presentation.category,
    date: parseStortingetDotNetDateToISO(detail.sist_oppdatert_dato ?? ''),
    votes,
    status: resolveSakListStatus({
      ferdigbehandlet: detail.ferdigbehandlet,
      numericStatus: detail.status,
    }),
    stortingetNumericStatus: typeof detail.status === 'number' ? detail.status : undefined,
    sakKind: presentation.kind,
    henvisning: presentation.henvisning,
    dokumentgruppe: typeof detail.dokumentgruppe === 'number' ? detail.dokumentgruppe : null,
    votingOpen: getSakVotingWindow(detail).isOpen,
    votingDaysLeft: getSakVotingWindow(detail).daysLeft,
  };
}

export interface StortingetParti {
  id: string;
  navn: string;
  representert_parti: boolean;
}

async function getVoteTotals(issueIds: string[]): Promise<Record<string, { for: number; against: number; abstain: number; total: number }>> {
  const result: Record<string, { for: number; against: number; abstain: number; total: number }> = {};

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return result;
  }

  try {
    const { getServiceSupabase } = await import('./supabase');
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

export async function getSaker(
  opts?: { nextRevalidateSeconds?: number; includeAll?: boolean; forceRefresh?: boolean },
): Promise<SakListItem[]> {
  try {
    const { getSakerWithCache } = await import('./stortinget-saker-cache');
    return await getSakerWithCache({
      includeAll: opts?.includeAll,
      preferDb: true,
      forceRefresh: opts?.forceRefresh === true,
    });
  } catch (error) {
    console.error('Error fetching saker:', error);
    return [];
  }
}

export async function getSak(id: string): Promise<SakListItem | null> {
  const bundle = await getSakPageBundle(id);
  return bundle?.sak ?? null;
}

export async function getSakPageBundle(
  id: string,
): Promise<{
  sak: SakListItem;
  detail: StortingetSakDetail;
  issueMeta: import('./stortinget-detail-cache').SakIssueMeta | null;
} | null> {
  const { getCachedSakDetail, getSakIssueMeta } = await import('./stortinget-detail-cache');
  const { getLiveListExportFields } = await import('./stortinget-saker-cache');
  const detail = await getCachedSakDetail(id);
  if (!detail) return null;

  const [voteTotals, issueMeta, listFields] = await Promise.all([
    getVoteTotals([id]),
    getSakIssueMeta(id),
    getLiveListExportFields(id),
  ]);
  const sak = mapDetailToListItem(detail, voteTotals[id] ?? EMPTY_VOTES);
  sak.status = resolveSakStatusFromSources({
    ferdigbehandlet: issueMeta?.ferdigbehandlet ?? null,
    detailJson: {
      ferdigbehandlet: detail.ferdigbehandlet,
      status: detail.status,
    },
    cachedStatus: issueMeta?.status ?? sak.status,
    numericStatus: listFields?.numericStatus,
    listInnstilling: listFields?.listInnstilling,
  });
  if (typeof listFields?.numericStatus === 'number') {
    sak.stortingetNumericStatus = listFields.numericStatus;
  }
  if (listFields?.listInnstilling) {
    sak.listInnstilling = listFields.listInnstilling;
  }

  if (issueMeta) {
    if (issueMeta.lastUpdatedAt && !sak.date) {
      sak.date = issueMeta.lastUpdatedAt.split('T')[0];
    }
    if (issueMeta.votingClosesAt) {
      const closesMs = new Date(issueMeta.votingClosesAt).getTime();
      if (closesMs <= Date.now()) {
        sak.votingOpen = false;
        sak.votingDaysLeft = 0;
      } else if (sak.status !== 'closed') {
        sak.votingOpen = true;
        sak.votingDaysLeft = Math.max(1, Math.ceil((closesMs - Date.now()) / 86_400_000));
      }
    }
  }

  if (sak.status === 'closed') {
    sak.votingOpen = false;
  }

  return { sak, detail, issueMeta };
}

export async function getSakDetail(
  sakId: string,
  opts?: { nextRevalidateSeconds?: number }
): Promise<StortingetSakDetail | null> {
  try {
    const res = await fetch(stortingetUrl('/eksport/sak', { sakid: sakId, format: 'json' satisfies StortingetFormat }), {
      next: opts?.nextRevalidateSeconds ? { revalidate: opts.nextRevalidateSeconds } : undefined,
      cache: opts?.nextRevalidateSeconds ? undefined : 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as StortingetSakDetail;
  } catch (e) {
    console.error('Error fetching sak detail:', e);
    return null;
  }
}

export interface StortingetRepresentant {
  id: string;
  fornavn: string;
  etternavn: string;
  fylke: {
    navn: string;
  };
  parti: {
    id: string;
    navn: string;
  };
}

export interface StortingetRegjeringsmedlem {
  id: string;
  fornavn: string;
  etternavn: string;
  tittel: string;
  verv: string;
  departement: string;
  sortering: number;
  parti: {
    id: string;
    navn: string;
  };
}

export interface PolitikerOversikt extends StortingetRepresentant {
  tittel?: string;
  departement?: string;
  erRegjeringsmedlem: boolean;
  regjeringsSortering?: number;
}

export async function getRepresentanter(): Promise<StortingetRepresentant[]> {
  try {
    const res = await fetch(stortingetUrl('/eksport/dagensrepresentanter', { format: 'json' satisfies StortingetFormat }), {
      next: { revalidate: 86400 }
    });
    if (!res.ok) throw new Error('Failed to fetch representanter');
    const data = await res.json();
    return data.dagensrepresentanter_liste || [];
  } catch (error) {
    console.error("Error fetching representanter:", error);
    return [];
  }
}

export async function getRepresentanterForPeriode(periodeId?: string): Promise<StortingetRepresentant[]> {
  try {
    const res = await fetch(
      stortingetUrl('/eksport/representanter', {
        stortingsperiodeid: periodeId || getActiveStortingsperiodeId(),
        format: 'json' satisfies StortingetFormat,
      }),
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error('Failed to fetch representanter (periode)');
    const data = await res.json();
    return data.representanter_liste || [];
  } catch (error) {
    console.error('Error fetching representanter (periode):', error);
    return [];
  }
}

export async function getRegjeringsmedlemmer(): Promise<StortingetRegjeringsmedlem[]> {
  try {
    const res = await fetch(stortingetUrl('/eksport/regjering', { format: 'json' satisfies StortingetFormat }), {
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error('Failed to fetch regjering');
    const data = await res.json();
    return data.regjeringsmedlemmer_liste || [];
  } catch (error) {
    console.error('Error fetching regjering:', error);
    return [];
  }
}

/** All MPs for the active period, enriched with government roles where applicable. */
export async function getPolitikereOversikt(periodeId?: string): Promise<PolitikerOversikt[]> {
  const [representanter, regjering] = await Promise.all([
    getRepresentanterForPeriode(periodeId),
    getRegjeringsmedlemmer(),
  ]);

  const map = new Map<string, PolitikerOversikt>();

  for (const rep of representanter) {
    map.set(rep.id, { ...rep, erRegjeringsmedlem: false });
  }

  for (const member of regjering) {
    const existing = map.get(member.id);
    if (existing) {
      map.set(member.id, {
        ...existing,
        tittel: member.tittel,
        departement: member.departement,
        erRegjeringsmedlem: true,
        regjeringsSortering: member.sortering,
      });
    } else {
      map.set(member.id, {
        id: member.id,
        fornavn: member.fornavn,
        etternavn: member.etternavn,
        fylke: { navn: 'Regjeringen' },
        parti: member.parti,
        tittel: member.tittel,
        departement: member.departement,
        erRegjeringsmedlem: true,
        regjeringsSortering: member.sortering,
      });
    }
  }

  return Array.from(map.values());
}

export interface StortingetPerson {
  id: string;
  fornavn: string;
  etternavn: string;
  kjoenn?: 'mann' | 'kvinne' | string;
  foedselsdato?: string;
  doedsdato?: string;
}

export async function getPerson(personId: string): Promise<StortingetPerson | null> {
  try {
    const res = await fetch(stortingetUrl('/eksport/person', { personid: personId, format: 'json' satisfies StortingetFormat }), {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('Error fetching person:', e);
    return null;
  }
}

export interface StortingetSaksgang {
  id: string;
  navn: string;
  saksgang_steg_liste?: Array<{
    id: string;
    navn: string;
    steg_nummer?: number;
  }>;
}

export async function getSaksganger(): Promise<StortingetSaksgang[]> {
  try {
    const res = await fetch(stortingetUrl('/eksport/saksganger', { format: 'json' satisfies StortingetFormat }), {
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error('Failed to fetch saksganger');
    const data = await res.json();
    return data.saksgang_liste || [];
  } catch (e) {
    console.error('Error fetching saksganger:', e);
    return [];
  }
}

export type SporsmalType = 'sporretimesporsmal' | 'interpellasjoner' | 'skriftligesporsmal';

export interface StortingetSporsmalOversiktResponse {
  sporsmal_liste?: any[];
}

export async function getSporsmalListe(args: {
  type: SporsmalType;
  sesjonId?: string;
  status?: string;
  nextRevalidateSeconds?: number;
}): Promise<any[]> {
  const sesjonId = args.sesjonId || getActiveSesjonId();
  try {
    const res = await fetch(
      stortingetUrl(`/eksport/${args.type}`, {
        sesjonid: sesjonId,
        status: args.status,
        format: 'json' satisfies StortingetFormat,
      }),
      {
        next: args.nextRevalidateSeconds ? { revalidate: args.nextRevalidateSeconds } : { revalidate: 3600 },
      }
    );
    if (!res.ok) throw new Error(`Failed to fetch spørsmål (${args.type})`);
    const data = (await res.json()) as StortingetSporsmalOversiktResponse;
    return data.sporsmal_liste || [];
  } catch (e) {
    console.error(`Error fetching spørsmål (${args.type}):`, e);
    return [];
  }
}

export async function getPartier(): Promise<StortingetParti[]> {
  try {
    const res = await fetch(stortingetUrl('/eksport/partier', { format: 'json' satisfies StortingetFormat }), {
      next: { revalidate: 86400 }
    });
    if (!res.ok) throw new Error('Failed to fetch partier');
    const data = await res.json();
    return data.partier_liste || [];
  } catch (error) {
    console.error("Error fetching partier:", error);
    return [];
  }
}
