import type { SupabaseClient } from '@supabase/supabase-js';

export type PendingEmbeddingIssue = {
  issueId: string;
  lastSyncedAtMs: number;
};

/** Newest activity first (matches catch-up / operator expectation). */
export function sortPendingEmbeddingIssuesNewestFirst(
  issues: PendingEmbeddingIssue[],
): string[] {
  return [...issues]
    .sort((a, b) => {
      if (b.lastSyncedAtMs !== a.lastSyncedAtMs) {
        return b.lastSyncedAtMs - a.lastSyncedAtMs;
      }
      return b.issueId.localeCompare(a.issueId, 'en');
    })
    .map((row) => row.issueId);
}

const PENDING_CHUNK_SCAN = 200;

/**
 * Distinct issues with legacy nomic `embedding_status = pending`, ordered newest first.
 * Never selects detail_json.
 */
export async function listPendingLegacyEmbeddingIssueIds(
  service: SupabaseClient,
  limit = 50,
): Promise<string[]> {
  const { data: pendingChunks, error: chunkError } = await service
    .from('document_chunks')
    .select('issue_id')
    .eq('embedding_status', 'pending')
    .limit(PENDING_CHUNK_SCAN);

  if (chunkError) {
    console.warn('[n8n] Could not list pending embedding chunks:', chunkError.message);
    return [];
  }

  const issueIdSet = new Set<string>();
  for (const row of pendingChunks ?? []) {
    if (typeof row.issue_id === 'string' && row.issue_id.trim()) {
      issueIdSet.add(row.issue_id.trim());
    }
  }

  if (issueIdSet.size === 0) {
    return [];
  }

  const issueIds = [...issueIdSet];
  const { data: issues, error: issueError } = await service
    .from('stortinget_issues')
    .select('id, last_synced_at')
    .in('id', issueIds);

  if (issueError) {
    console.warn('[n8n] Could not load issue sync times for embedding catch-up:', issueError.message);
    return issueIds.slice(0, limit);
  }

  const ranked: PendingEmbeddingIssue[] = (issues ?? [])
    .map((row) => {
      const id = typeof row.id === 'string' ? row.id : null;
      if (!id) return null;
      const synced =
        typeof row.last_synced_at === 'string' ? Date.parse(row.last_synced_at) : Number.NaN;
      return {
        issueId: id,
        lastSyncedAtMs: Number.isFinite(synced) ? synced : 0,
      };
    })
    .filter((row): row is PendingEmbeddingIssue => row !== null);

  const sorted = sortPendingEmbeddingIssuesNewestFirst(ranked);
  return sorted.slice(0, Math.max(1, limit));
}
