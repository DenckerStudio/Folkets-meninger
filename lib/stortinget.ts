'use server';

import { STORTINGET_ACTIVE_PERIODE_ID, STORTINGET_ACTIVE_SESSION_ID } from './stortinget-config';
import {
  isDebattSak,
  mapSakPresentation,
  type SakKind,
} from './stortinget-sak-presentation';
import {
  resolveSakTreatmentStatus,
  type SakTreatmentStatus,
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
    status: resolveSakTreatmentStatus({
      ferdigbehandlet: detail.ferdigbehandlet,
      numericStatus: detail.status,
    }),
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

  if (issueIds.length === 0 || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return result;
  }

  try {
    const { getServiceSupabase } = await import('./supabase');
    const service = getServiceSupabase();
    const chunkSize = 200;
    const now = Date.now();

    for (let i = 0; i < issueIds.length; i += chunkSize) {
      const chunk = issueIds.slice(i, i + chunkSize);
      const { data, error } = await service
        .from('stortinget_issues')
        .select('id, status, detail_json, ferdigbehandlet, voting_closes_at, last_updated_at')
        .in('id', chunk);

      if (error || !data) continue;

      for (const row of data) {
        const detail = row.detail_json as StortingetSakDetail | null;
        const ferdigbehandlet =
          typeof detail?.ferdigbehandlet === 'boolean' ? detail.ferdigbehandlet : row.ferdigbehandlet;

        const status =
          typeof ferdigbehandlet === 'boolean'
            ? resolveSakTreatmentStatus({
                ferdigbehandlet,
                numericStatus: detail?.status,
              })
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
            votingDaysLeft = Math.max(1, Math.ceil((closesMs - now) / 86_400_000));
          }
        } else if (detail) {
          const window = getSakVotingWindow(detail, { ferdigbehandlet });
          votingOpen = window.isOpen && status !== 'closed';
          votingDaysLeft = window.daysLeft;
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

export async function getSaker(
  opts?: { nextRevalidateSeconds?: number; includeAll?: boolean }
): Promise<SakListItem[]> {
  try {
    const res = await fetch(
      stortingetUrl('/eksport/saker', { stortingssesjonid: getActiveSesjonId(), format: 'json' satisfies StortingetFormat }),
      {
        next: opts?.nextRevalidateSeconds ? { revalidate: opts.nextRevalidateSeconds } : undefined,
        cache: opts?.nextRevalidateSeconds ? undefined : 'no-store',
      }
    );
    if (!res.ok) throw new Error('Failed to fetch saker');
    const data = (await res.json()) as { saker_liste?: StortingetSak[] };

    const rawSaker = data.saker_liste ?? [];
    const filtered = opts?.includeAll
      ? rawSaker
      : rawSaker.filter((sak) =>
          isDebattSak({
            korttittel: sak.korttittel,
            tittel: sak.tittel,
            henvisning: sak.henvisning,
            dokumentgruppe: sak.dokumentgruppe,
          })
        );

    const saker = filtered.map((sak) => mapStortingetSakToListItem(sak));

    const cachedOverlays = await getCachedIssueOverlays(saker.map((s) => s.id));
    for (const sak of saker) {
      const cached = cachedOverlays[sak.id];
      if (!cached) continue;
      sak.status = cached.status;
      sak.votingOpen = cached.votingOpen;
      sak.votingDaysLeft = cached.votingDaysLeft;
      if (!sak.date && cached.lastUpdatedAt) {
        sak.date = cached.lastUpdatedAt.split('T')[0];
      }
    }

    const voteTotals = await getVoteTotals(saker.map((s) => s.id));

    for (const sak of saker) {
      if (voteTotals[sak.id]) {
        sak.votes = voteTotals[sak.id];
      }
    }

    return saker;
  } catch (error) {
    console.error('Error fetching saker:', error);
    return [];
  }
}

export async function getSak(id: string): Promise<SakListItem | null> {
  const detail = await getSakDetail(id, { nextRevalidateSeconds: 3600 });
  if (!detail) return null;

  const voteTotals = await getVoteTotals([id]);
  const item = mapDetailToListItem(detail, voteTotals[id] ?? EMPTY_VOTES);

  if (!item.date) {
    const { getSakIssueMeta } = await import('./stortinget-detail-cache');
    const meta = await getSakIssueMeta(id);
    if (meta?.lastUpdatedAt) {
      item.date = meta.lastUpdatedAt.split('T')[0];
    }
  }

  return item;
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
