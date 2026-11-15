import { fetchCentralQueryEmbedding } from '@/lib/chat/query-embed';
import { mapHybridChunkRow } from '@/lib/chat/rag';
import {
  isMissingSearchChunksHybridRpcError,
  warnChatRpcError,
} from '@/lib/chat/rag-rpc-error';
import { getChatRagRpcClient } from '@/lib/chat/rag-rpc-client';
import { filterBlockedSourceHits, hostnameFromUrl } from '@/lib/sources/blocklist';
import type { NormalizedSourceHit } from '@/lib/sources/types';

const DEFAULT_STORTINGET_LIMIT = 10;

function stortingetSakUrl(issueId: string): string {
  return `https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${encodeURIComponent(issueId)}`;
}

function mapChunkToSourceHit(
  chunk: ReturnType<typeof mapHybridChunkRow>,
  issueId: string | null,
): NormalizedSourceHit | null {
  if (!chunk) return null;
  const url =
    chunk.sourceUrl?.trim() ||
    (issueId ? stortingetSakUrl(issueId) : null);
  if (!url) return null;
  const title = chunk.documentTitle?.trim() || 'Stortinget-dokument';
  const snippet = chunk.content.trim().slice(0, 320);
  if (!snippet) return null;
  return {
    title,
    url,
    domain: hostnameFromUrl(url) ?? 'stortinget.no',
    snippet,
    sourceType: 'stortinget',
  };
}

export type StortingetSourceSearchOptions = {
  issueId?: string | null;
  limit?: number;
  matchCount?: number;
};

export async function searchStortingetSources(
  query: string,
  options: StortingetSourceSearchOptions = {},
): Promise<NormalizedSourceHit[]> {
  const needle = query.trim().slice(0, 120);
  if (!needle) return [];

  const rpc = getChatRagRpcClient();
  if (!rpc?.rpc) return [];

  const embedding = await fetchCentralQueryEmbedding(needle);
  const issueId = options.issueId?.trim() || null;
  const limit = options.limit ?? DEFAULT_STORTINGET_LIMIT;
  const matchCount = options.matchCount ?? Math.min(limit * 3, 24);

  try {
    const { data, error } = await rpc.rpc('search_chunks_hybrid', {
      query_text: needle,
      query_embedding: embedding,
      filter_issue_ids: issueId ? [issueId] : null,
      filter_document_kinds: null,
      filter_sesjon: null,
      filter_komite: null,
      filter_ferdigbehandlet: null,
      filter_published_after: null,
      filter_hearing_id: null,
      match_count: matchCount,
    });
    if (error) {
      if (!isMissingSearchChunksHybridRpcError(error)) {
        warnChatRpcError('search_chunks_hybrid', error);
      }
      return [];
    }
    if (!Array.isArray(data)) return [];

    const hits: NormalizedSourceHit[] = [];
    const seenDocs = new Set<string>();
    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      const record = row as Record<string, unknown>;
      const docId = String(record.document_id ?? '').trim();
      if (docId && seenDocs.has(docId)) continue;
      if (docId) seenDocs.add(docId);
      const mapped = mapHybridChunkRow(record);
      const hit = mapChunkToSourceHit(mapped, issueId);
      if (!hit) continue;
      hits.push(hit);
      if (hits.length >= limit) break;
    }
    return filterBlockedSourceHits(hits);
  } catch {
    return [];
  }
}