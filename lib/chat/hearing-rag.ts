import type { SupabaseClient } from '@supabase/supabase-js';
import { getAnonSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import type { ChatRagClient } from '@/lib/chat/rag';
import { getHoringSkriftligInnspillUrl, type StortingetHoring } from '@/lib/stortinget-horinger';
import {
  hearingDbConfigured,
  loadStortingetHearingByIdFromDb,
} from '@/lib/stortinget-hearing-db';

const MAX_CHUNKS = 8;

export type HearingChunkHit = {
  chunkId: string;
  hearingId: string;
  hearingDocumentId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  documentTitle: string | null;
  documentKind: string | null;
  sourceUrl: string | null;
  rank: number;
};

export type HearingSearchMeta = {
  id: string;
  title: string;
  committee: string | null;
  deadline: string | null;
  skriftligInnspillUrl: string;
};

export type HearingDocumentSearchResult = {
  hearing: HearingSearchMeta | null;
  chunks: HearingChunkHit[];
  note: string | null;
};

type HybridChunkRow = {
  id?: string;
  chunk_id?: string;
  hearing_id?: string;
  hearing_document_id?: string;
  document_id?: string;
  chunk_index?: number;
  content?: string;
  document_title?: string;
  document_kind?: string;
  source_url?: string;
  score_fused?: number;
  rank?: number;
};

function clip(value: string, max = 1400): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function isMissingHearingHybridRpcError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const row = error as { code?: string; message?: string };
  if (row.code === 'PGRST202') return true;
  const message = row.message ?? '';
  if (/search_chunks_hybrid/i.test(message) && /not find|schema cache|unknown|filter_hearing_id/i.test(message)) {
    return true;
  }
  return false;
}

async function resolveRagClient(client?: ChatRagClient | null): Promise<ChatRagClient> {
  if (client) return client;
  try {
    const sessionClient = await getServerSupabase();
    if (sessionClient) return sessionClient;
  } catch {
    // fall through
  }
  return getAnonSupabase();
}

function mapHybridHearingChunkRow(
  row: HybridChunkRow,
  fallbackHearingId: string | null,
): HearingChunkHit | null {
  const chunkId = String(row.id ?? row.chunk_id ?? '').trim();
  const content = clip(String(row.content ?? ''));
  if (!chunkId || !content) return null;

  return {
    chunkId,
    hearingId: String(row.hearing_id ?? fallbackHearingId ?? ''),
    hearingDocumentId: String(row.hearing_document_id ?? ''),
    documentId: String(row.document_id ?? ''),
    chunkIndex: Number(row.chunk_index ?? 0),
    content,
    documentTitle: row.document_title?.trim() || null,
    documentKind: row.document_kind?.trim() || null,
    sourceUrl: row.source_url?.trim() || null,
    rank: Number(row.score_fused ?? row.rank ?? 0),
  };
}

async function trySearchChunksHybrid(
  supabase: ChatRagClient,
  query: string,
  hearingId: string | null,
  limit: number,
): Promise<HearingChunkHit[] | null> {
  const rpc = supabase as SupabaseClient;
  const { data, error } = await rpc.rpc('search_chunks_hybrid', {
    query_text: query,
    query_embedding: null,
    filter_issue_ids: null,
    filter_hearing_id: hearingId,
    filter_document_kinds: null,
    filter_sesjon: null,
    filter_komite: null,
    filter_ferdigbehandlet: null,
    filter_published_after: null,
    match_count: limit,
  });

  if (error) {
    if (isMissingHearingHybridRpcError(error)) return null;
    return null;
  }
  if (!Array.isArray(data)) return null;

  const hits = data
    .map((row) => mapHybridHearingChunkRow(row as HybridChunkRow, hearingId))
    .filter((row): row is HearingChunkHit => row != null);

  return hits.length > 0 ? hits : null;
}

async function searchHearingChunksLexical(
  supabase: ChatRagClient,
  query: string,
  hearingId: string | null,
  limit: number,
): Promise<HearingChunkHit[]> {
  const rpc = supabase as SupabaseClient;
  const { data, error } = await rpc.rpc('search_hearing_document_chunks_text', {
    p_query: query,
    p_hearing_id: hearingId,
    p_match_count: limit,
  });

  if (error || !Array.isArray(data)) return [];

  return data
    .map((row) => row as Record<string, unknown>)
    .map((row) => ({
      chunkId: String(row.chunk_id ?? ''),
      hearingId: String(row.hearing_id ?? hearingId ?? ''),
      hearingDocumentId: String(row.hearing_document_id ?? ''),
      documentId: String(row.document_id ?? ''),
      chunkIndex: Number(row.chunk_index ?? 0),
      content: clip(String(row.content ?? '')),
      documentTitle: typeof row.document_title === 'string' ? row.document_title : null,
      documentKind: typeof row.document_kind === 'string' ? row.document_kind : null,
      sourceUrl: typeof row.source_url === 'string' ? row.source_url : null,
      rank: Number(row.rank ?? 0),
    }))
    .filter((row) => row.content.length > 0);
}

async function loadHearingMeta(hearingId: string): Promise<HearingSearchMeta | null> {
  const hearing: StortingetHoring | null = await loadStortingetHearingByIdFromDb(hearingId);

  let data: Record<string, unknown> | null = null;
  if (hearingDbConfigured()) {
    const supabase = getAnonSupabase();
    const { data: row } = await supabase
      .from('stortinget_hearings')
      .select('id, tittel, komite_navn, innspillsfrist, skriftlig_innspill_url')
      .eq('id', hearingId)
      .maybeSingle();
    data = row as Record<string, unknown> | null;
  }

  if (!data && !hearing) return null;

  const title =
    (typeof data?.tittel === 'string' && data.tittel.trim()) ||
    hearing?.horing_sak_info_liste?.[0]?.sak_tittel?.trim() ||
    `Høring ${hearingId}`;

  const committee =
    (typeof data?.komite_navn === 'string' && data.komite_navn.trim()) ||
    hearing?.komite?.navn?.trim() ||
    null;

  const deadline =
    typeof data?.innspillsfrist === 'string'
      ? data.innspillsfrist
      : hearing?.innspillsfrist ?? null;

  const skriftligUrl =
    (typeof data?.skriftlig_innspill_url === 'string' && data.skriftlig_innspill_url.trim()) ||
    (hearing ? getHoringSkriftligInnspillUrl(hearing) : getHoringSkriftligInnspillUrl({ id: hearingId }));

  return {
    id: hearingId,
    title,
    committee,
    deadline,
    skriftligInnspillUrl: skriftligUrl,
  };
}

export async function searchHearingDocuments(args: {
  query: string;
  hearingId?: string | null;
  client?: ChatRagClient | null;
  limit?: number;
}): Promise<HearingDocumentSearchResult> {
  const query = args.query.trim();
  const hearingId = args.hearingId?.trim() || null;
  const limit = args.limit ?? MAX_CHUNKS;

  if (query.length < 2) {
    return { hearing: null, chunks: [], note: 'Spørringen må ha minst to tegn.' };
  }

  const supabase = await resolveRagClient(args.client ?? null);
  const hybrid = await trySearchChunksHybrid(supabase, query, hearingId, limit);
  const chunks =
    hybrid ?? (await searchHearingChunksLexical(supabase, query, hearingId, limit));

  const hearing = hearingId ? await loadHearingMeta(hearingId) : null;

  return {
    hearing,
    chunks,
    note:
      chunks.length === 0
        ? 'Fant ingen dokumentutdrag i høringskildene for denne spørringen.'
        : null,
  };
}
