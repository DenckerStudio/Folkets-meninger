import type { ChatRagClient } from '@/lib/chat/rag';
import {
  excerptChunkForQuery,
  formatChunkExcerptForDisplay,
  normalizeChunkText,
} from '@/lib/chat/chunk-excerpt';
import { fetchCentralQueryEmbedding } from '@/lib/chat/query-embed';
import {
  isMissingSearchChunksHybridRpcError,
  warnChatRpcError,
} from '@/lib/chat/rag-rpc-error';
import { getChatRagRpcClient } from '@/lib/chat/rag-rpc-client';
import { mapHybridChunkRow } from '@/lib/chat/rag';
import {
  type TopicAroundPeriod,
  type TopicAroundSort,
  documentKindsToRpcFilter,
  periodToPublishedAfter,
} from '@/lib/search/topic-around-filters';
import { buildTopicAroundRelatedReason } from '@/lib/search/topic-around-query';
import { isTopicAroundSearchEnabled } from '@/lib/search/topic-around-enabled';
import type { SakDocumentKind } from '@/lib/stortinget-documents';
import { normalizeUtforskIssueSearchQuery } from '@/lib/search/utforsk-issue-search-api';

const DEFAULT_MATCH_COUNT = 56;
const DISPLAY_EXCERPT_CHARS = 360;
const MAX_ITEMS = 24;

export type TopicAroundSearchItem = {
  issueId: string;
  issueTitle: string;
  excerpt: string | null;
  documentTitle: string | null;
  documentKind: string | null;
  sourceUrl: string | null;
  relatedReason: string;
  relevanceScore: number;
  publishedAt: string | null;
};

export type TopicAroundSearchFilters = {
  documentKinds?: readonly SakDocumentKind[] | null;
  period?: TopicAroundPeriod;
  sort?: TopicAroundSort;
  excludeIssueIds?: readonly string[];
};

export type TopicAroundSearchSuccess = {
  ok: true;
  items: TopicAroundSearchItem[];
  themeLabel: string;
};

export type TopicAroundSearchFailure = {
  ok: false;
  reason:
    | 'disabled'
    | 'empty_query'
    | 'embedding_unavailable'
    | 'rpc_failed'
    | 'timeout';
};

const DEFAULT_TOPIC_AROUND_SEARCH_TIMEOUT_MS = 8000;

export function topicAroundSearchTimeoutMs(): number {
  const raw = process.env.TOPIC_AROUND_SEARCH_TIMEOUT_MS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 500) return n;
  }
  return DEFAULT_TOPIC_AROUND_SEARCH_TIMEOUT_MS;
}

export type TopicAroundSearchResult = TopicAroundSearchSuccess | TopicAroundSearchFailure;

type HybridChunkRow = Record<string, unknown> & {
  issue_id?: unknown;
  score_fused?: unknown;
  score_semantic?: unknown;
  score_lexical?: unknown;
};

function hybridRowScore(row: HybridChunkRow): number {
  const fused = Number(row.score_fused ?? 0);
  const semantic = Number(row.score_semantic ?? 0);
  const lexical = Number(row.score_lexical ?? 0);
  if (Number.isFinite(fused) && fused > 0) return fused;
  if (Number.isFinite(semantic) && semantic > 0) return semantic;
  if (Number.isFinite(lexical) && lexical > 0) return lexical;
  return 0;
}

async function loadIssueMetaForTopicAround(
  client: ChatRagClient,
  issueIds: readonly string[],
): Promise<Map<string, { title: string; publishedAt: string | null }>> {
  const map = new Map<string, { title: string; publishedAt: string | null }>();
  const ids = [...new Set(issueIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return map;

  const { data, error } = await client
    .from('stortinget_issues')
    .select('id, title, first_seen_at')
    .in('id', ids);

  if (error || !Array.isArray(data)) return map;

  for (const row of data) {
    const id = String(row.id ?? '').trim();
    if (!id) continue;
    const title = String(row.title ?? '').trim() || id;
    const publishedAt =
      typeof row.first_seen_at === 'string' && row.first_seen_at.trim()
        ? row.first_seen_at.trim()
        : null;
    map.set(id, { title, publishedAt });
  }
  return map;
}

function sortTopicAroundItems(
  items: TopicAroundSearchItem[],
  sort: TopicAroundSort,
): TopicAroundSearchItem[] {
  if (sort === 'date') {
    return [...items].sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      if (bTime !== aTime) return bTime - aTime;
      return b.relevanceScore - a.relevanceScore || a.issueId.localeCompare(b.issueId);
    });
  }
  return [...items].sort(
    (a, b) => b.relevanceScore - a.relevanceScore || a.issueId.localeCompare(b.issueId),
  );
}

export async function fetchTopicAroundSearch(input: {
  query: string;
  themeLabel: string;
  filters?: TopicAroundSearchFilters;
}): Promise<TopicAroundSearchResult> {
  if (!isTopicAroundSearchEnabled()) {
    return { ok: false, reason: 'disabled' };
  }

  const { query, shouldSearch } = normalizeUtforskIssueSearchQuery(input.query);
  if (!shouldSearch) {
    return { ok: false, reason: 'empty_query' };
  }

  const rpc = getChatRagRpcClient();
  if (!rpc?.rpc) {
    return { ok: false, reason: 'rpc_failed' };
  }

  const embedding = await fetchCentralQueryEmbedding(query);
  if (!embedding) {
    return { ok: false, reason: 'embedding_unavailable' };
  }

  const filters = input.filters ?? {};
  const period = filters.period ?? 'all';
  const sort = filters.sort ?? 'relevance';
  const exclude = new Set(
    (filters.excludeIssueIds ?? []).map((id) => id.trim()).filter(Boolean),
  );

  try {
    const { data, error } = await rpc.rpc('search_chunks_hybrid', {
      query_text: query,
      query_embedding: embedding,
      filter_issue_ids: null,
      filter_document_kinds: documentKindsToRpcFilter(filters.documentKinds),
      filter_sesjon: null,
      filter_komite: null,
      filter_ferdigbehandlet: null,
      filter_published_after: periodToPublishedAfter(period),
      filter_hearing_id: null,
      match_count: DEFAULT_MATCH_COUNT,
    });

    if (error) {
      if (!isMissingSearchChunksHybridRpcError(error)) {
        warnChatRpcError('search_chunks_hybrid', error);
      }
      return { ok: false, reason: 'rpc_failed' };
    }

    const rows = Array.isArray(data) ? (data as HybridChunkRow[]) : [];
    const bestByIssue = new Map<string, { row: HybridChunkRow; score: number }>();

    for (const row of rows) {
      const issueId = String(row.issue_id ?? '').trim();
      if (!issueId || exclude.has(issueId)) continue;
      const score = hybridRowScore(row);
      if (score <= 0) continue;
      const prev = bestByIssue.get(issueId);
      if (!prev || score > prev.score) {
        bestByIssue.set(issueId, { row, score });
      }
    }

    const issueIds = [...bestByIssue.keys()];
    const issueMeta = await loadIssueMetaForTopicAround(rpc, issueIds);
    const relatedReason = buildTopicAroundRelatedReason(input.themeLabel);

    const items: TopicAroundSearchItem[] = [];
    for (const [issueId, { row, score }] of bestByIssue) {
      const chunk = mapHybridChunkRow(row);
      const meta = issueMeta.get(issueId);
      const issueTitle = meta?.title ?? issueId;
      const rawContent = chunk?.content
        ? normalizeChunkText(chunk.content)
        : normalizeChunkText(String(row.content ?? ''));
      const excerpt = rawContent
        ? formatChunkExcerptForDisplay(
            excerptChunkForQuery(rawContent, query, DISPLAY_EXCERPT_CHARS),
          )
        : null;

      items.push({
        issueId,
        issueTitle,
        excerpt,
        documentTitle: chunk?.documentTitle ?? null,
        documentKind: chunk?.documentKind ?? null,
        sourceUrl: chunk?.sourceUrl ?? null,
        relatedReason,
        relevanceScore: score,
        publishedAt: meta?.publishedAt ?? null,
      });
    }

    const sorted = sortTopicAroundItems(items, sort).slice(0, MAX_ITEMS);
    return { ok: true, items: sorted, themeLabel: input.themeLabel.trim() || query };
  } catch {
    return { ok: false, reason: 'rpc_failed' };
  }
}

/** Bound slow embed/RPC so sakssiden kan strømme resten i Suspense. */
export async function fetchTopicAroundSearchWithTimeout(input: Parameters<
  typeof fetchTopicAroundSearch
>[0]): Promise<TopicAroundSearchResult> {
  const ms = topicAroundSearchTimeoutMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetchTopicAroundSearch(input),
      new Promise<TopicAroundSearchFailure>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}