import type { SupabaseClient } from '@supabase/supabase-js';
import { getAnonSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import type { ChatRagClient } from '@/lib/chat/rag';
import {
  fetchStortingetHoringById,
  getHoringInnspillDeadline,
  getHoringSkriftligInnspillUrl,
  getHoringTitle,
  type StortingetHoring,
} from '@/lib/stortinget-horinger';

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
  documentsIndexed: boolean;
  note: string | null;
  guidance: string | null;
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

export function isMissingHearingDocumentSearchRpcError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const row = error as { code?: string; message?: string };
  if (row.code === 'PGRST202') return true;
  const message = row.message ?? '';
  return /search_hearing_document_chunks_text/i.test(message) && /not find|schema cache/i.test(message);
}

export function hearingSearchNoteForEmptyChunks(args: {
  documentsIndexed: boolean;
  lexicalRpcMissing: boolean;
}): { note: string; guidance: string | null } {
  if (!args.documentsIndexed) {
    return {
      note:
        'Høringsdokumentene er ikke indeksert i databasen ennå, så det finnes ingen tekstutdrag å søke i.',
      guidance:
        'Bruk findHearingsForSak eller listOpenHearings for tittel, frist, komité og lenke til skriftlig innspill.',
    };
  }
  return {
    note: 'Fant ingen dokumentutdrag i høringskildene for denne spørringen.',
    guidance: null,
  };
}

export function hearingChunkDocumentLabel(chunk: Pick<HearingChunkHit, 'documentTitle' | 'hearingId'>): string {
  if (chunk.documentTitle?.trim()) return chunk.documentTitle.trim();
  return chunk.hearingId ? 'Høringsdokument' : 'Dokument';
}

export function hearingMetaFromStortingetExport(
  hearingId: string,
  hearing: StortingetHoring,
): HearingSearchMeta {
  const deadline = getHoringInnspillDeadline(hearing);
  return {
    id: hearingId,
    title: getHoringTitle(hearing),
    committee: hearing.komite?.navn?.trim() || null,
    deadline: deadline ? deadline.toISOString() : null,
    skriftligInnspillUrl: getHoringSkriftligInnspillUrl(hearing),
  };
}

export async function resolveHearingSearchMeta(hearingId: string): Promise<HearingSearchMeta | null> {
  const hearing = await fetchStortingetHoringById(hearingId);
  if (!hearing) return null;
  return hearingMetaFromStortingetExport(hearingId, hearing);
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

function isHearingChunkRow(row: HybridChunkRow, filterHearingId: string | null): boolean {
  if (!filterHearingId) return true;
  const hearingId = String(row.hearing_id ?? '').trim();
  return hearingId === filterHearingId;
}

function mapHybridHearingChunkRow(
  row: HybridChunkRow,
  fallbackHearingId: string | null,
): HearingChunkHit | null {
  const chunkId = String(row.id ?? row.chunk_id ?? '').trim();
  const content = clip(String(row.content ?? ''));
  if (!chunkId || !content) return null;

  const hearingId = String(row.hearing_id ?? fallbackHearingId ?? '').trim();

  return {
    chunkId,
    hearingId,
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
  if (!hearingId) return null;

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
    .filter((row): row is HearingChunkHit => row != null)
    .filter((row) => isHearingChunkRow({ hearing_id: row.hearingId }, hearingId));

  return hits.length > 0 ? hits : null;
}

async function searchHearingChunksLexical(
  supabase: ChatRagClient,
  query: string,
  hearingId: string | null,
  limit: number,
): Promise<{ chunks: HearingChunkHit[]; rpcMissing: boolean }> {
  const rpc = supabase as SupabaseClient;
  const { data, error } = await rpc.rpc('search_hearing_document_chunks_text', {
    p_query: query,
    p_hearing_id: hearingId,
    p_match_count: limit,
  });

  if (error) {
    return { chunks: [], rpcMissing: isMissingHearingDocumentSearchRpcError(error) };
  }
  if (!Array.isArray(data)) {
    return { chunks: [], rpcMissing: false };
  }

  const chunks = data
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

  return { chunks, rpcMissing: false };
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

  const hearing = hearingId ? await resolveHearingSearchMeta(hearingId) : null;

  if (query.length < 2) {
    return {
      hearing,
      chunks: [],
      documentsIndexed: false,
      note: 'Spørringen må ha minst to tegn.',
      guidance: null,
    };
  }

  const supabase = await resolveRagClient(args.client ?? null);
  const hybrid = await trySearchChunksHybrid(supabase, query, hearingId, limit);
  let lexicalRpcMissing = false;
  let chunks = hybrid ?? [];

  if (chunks.length === 0) {
    const lexical = await searchHearingChunksLexical(supabase, query, hearingId, limit);
    lexicalRpcMissing = lexical.rpcMissing;
    chunks = lexical.chunks;
  }

  if (chunks.length > 0) {
    return {
      hearing,
      chunks,
      documentsIndexed: true,
      note: null,
      guidance: null,
    };
  }

  const documentsIndexed = !lexicalRpcMissing;
  const { note, guidance } = hearingSearchNoteForEmptyChunks({
    documentsIndexed,
    lexicalRpcMissing,
  });

  return {
    hearing,
    chunks,
    documentsIndexed,
    note,
    guidance,
  };
}
