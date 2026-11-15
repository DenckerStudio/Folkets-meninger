import { fetchCentralQueryEmbedding } from '@/lib/chat/query-embed';
import {
  isMissingSearchChunksHybridRpcError,
  warnChatRpcError,
} from '@/lib/chat/rag-rpc-error';
import { getChatRagRpcClient } from '@/lib/chat/rag-rpc-client';
import { searchIssuesForChat } from '@/lib/chat/rag';

const RRF_K = 60;
const DEFAULT_UTFORSK_HYBRID_CHUNK_BUDGET = 72;

export type HybridChunkIssueScore = {
  id: string;
  score: number;
};

/**
 * Pick the best fused score per sak from hybrid chunk hits (global search).
 */
export function aggregateHybridChunksByIssue(
  rows: ReadonlyArray<Record<string, unknown>>,
): HybridChunkIssueScore[] {
  const best = new Map<string, number>();
  for (const row of rows) {
    const id = String(row.issue_id ?? '').trim();
    if (!id) continue;
    const fused = Number(row.score_fused ?? 0);
    const semantic = Number(row.score_semantic ?? 0);
    const lexical = Number(row.score_lexical ?? 0);
    const score =
      Number.isFinite(fused) && fused > 0
        ? fused
        : Number.isFinite(semantic) && semantic > 0
          ? semantic
          : Number.isFinite(lexical)
            ? lexical
            : 0;
    if (score <= 0) continue;
    const prev = best.get(id);
    if (prev === undefined || score > prev) best.set(id, score);
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, score]) => ({ id, score }));
}

/** Reciprocal-rank fusion of FTS issue ids and hybrid per-sak scores. */
export function mergeFtsAndHybridIssueRanks(
  ftsIds: readonly string[],
  hybrid: readonly HybridChunkIssueScore[],
  limit: number,
): string[] {
  const merged = new Map<string, number>();

  ftsIds.forEach((id, index) => {
    const key = id.trim();
    if (!key) return;
    merged.set(key, (merged.get(key) ?? 0) + 1 / (RRF_K + index + 1));
  });

  hybrid.forEach((row, index) => {
    const key = row.id.trim();
    if (!key) return;
    merged.set(key, (merged.get(key) ?? 0) + 1 / (RRF_K + index + 1));
  });

  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(limit, 1))
    .map(([id]) => id);
}

/**
 * Rank saker for Utforsk using bge-m3 + search_chunks_hybrid, fused with search_issues_fts.
 * Returns `null` when embedding or hybrid RPC is unavailable (caller uses lexical filter).
 */
export async function rankUtforskIssuesHybrid(
  query: string,
  limit = 80,
): Promise<string[] | null> {
  const needle = query.trim().slice(0, 120);
  if (!needle) return null;

  const embedding = await fetchCentralQueryEmbedding(needle);
  if (!embedding) return null;

  const rpc = getChatRagRpcClient();
  if (!rpc?.rpc) return null;

  const chunkBudget = Math.min(Math.max(limit * 2, 24), DEFAULT_UTFORSK_HYBRID_CHUNK_BUDGET);

  try {
    const [ftsIssues, hybridRes] = await Promise.all([
      searchIssuesForChat(needle, Math.min(limit, 40), rpc),
      rpc.rpc('search_chunks_hybrid', {
        query_text: needle,
        query_embedding: embedding,
        filter_issue_ids: null,
        filter_document_kinds: null,
        filter_sesjon: null,
        filter_komite: null,
        filter_ferdigbehandlet: null,
        filter_published_after: null,
        filter_hearing_id: null,
        match_count: chunkBudget,
      }),
    ]);

    if (hybridRes.error) {
      if (!isMissingSearchChunksHybridRpcError(hybridRes.error)) {
        warnChatRpcError('search_chunks_hybrid', hybridRes.error);
      }
      return null;
    }

    const rawChunks = Array.isArray(hybridRes.data)
      ? (hybridRes.data as Record<string, unknown>[])
      : [];
    const hybridByIssue = aggregateHybridChunksByIssue(rawChunks);
    const ftsIds = ftsIssues.map((row) => row.id);

    if (hybridByIssue.length === 0 && ftsIds.length === 0) {
      return [];
    }

    return mergeFtsAndHybridIssueRanks(ftsIds, hybridByIssue, limit);
  } catch {
    return null;
  }
}