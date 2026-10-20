import type { ChatDocumentChunk, ChatIssueHit } from '@/lib/chat/rag';
import {
  applyChunkExcerptsForChat,
  applyTopicWideChunkExcerpts,
} from '@/lib/chat/chunk-excerpt';
import { buildSearchTerms } from '@/lib/chat/sak-search';
import { rerankCandidates, rerankerEnabled, shouldRejectRetrieval } from './rerank';
function clipContent(value: string, max = 1400): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}
import type pg from 'pg';
import { embedBgeM3, embedNomic } from './embed';
import type { EvalVariant } from './db';
import { capChunksPerDocument } from '@/lib/chat/chunk-excerpt';

export type RetrievedRow = ChatDocumentChunk & { chunkId?: string };

const MAX_CHUNKS = 10;

async function applyRetrievalGate(
  query: string,
  rows: RetrievedRow[],
  excerpts: RetrievedRow[],
): Promise<{ rows: RetrievedRow[]; excerpts: RetrievedRow[] }> {
  if (rows.length === 0) return { rows, excerpts };
  const gate = rerankerEnabled() || process.env.RAG_REJECTION_THRESHOLD;
  if (!gate) return { rows, excerpts };

  const top = rows.slice(0, 30);
  const { scores } = await rerankCandidates(
    query,
    top.map((r) => ({ id: `${r.documentId}:${r.chunkIndex}`, content: r.content, fusedScore: r.rank })),
  );
  const best = scores.length > 0 ? Math.max(...scores) : 0;
  if (shouldRejectRetrieval(best)) return { rows: [], excerpts: [] };
  return { rows, excerpts };
}

async function hybridSearch(
  pool: pg.Pool,
  query: string,
  filters: { issueIds?: string[]; hearingId?: string },
  limit: number,
): Promise<RetrievedRow[]> {
  const embedding = await embedBgeM3(query);
  const vector = `[${embedding.join(',')}]`;
  const { rows } = await pool.query(
    `SELECT * FROM search_chunks_hybrid(
      $1::text,
      $2::vector(1024),
      $3::text[],
      NULL::text[],
      NULL::text,
      NULL::text,
      NULL::boolean,
      NULL::timestamptz,
      $4::text,
      $5::int
    )`,
    [query, vector, filters.issueIds ?? null, filters.hearingId ?? null, limit],
  );
  return rows.map((row) => ({
    chunkId: String(row.id),
    documentId: String(row.document_id),
    chunkIndex: Number(row.chunk_index),
    content: String(row.content ?? ''),
    documentTitle: row.document_title as string | null,
    documentKind: row.document_kind as string | null,
    sourceUrl: row.source_url as string | null,
    rank: Number(row.score_fused ?? row.score_lexical ?? 0),
  }));
}

async function baselineLexical(
  pool: pg.Pool,
  issue: ChatIssueHit,
  query: string,
  limit: number,
): Promise<RetrievedRow[]> {
  const { rows } = await pool.query(
    `SELECT document_id, chunk_index, content, metadata FROM document_chunks WHERE issue_id=$1 ORDER BY chunk_index LIMIT 60`,
    [issue.id],
  );
  const needle = query.toLowerCase();
  const words = needle.split(/\s+/).filter((w) => w.length > 2);
  return rows
    .map((row) => {
      const content = clipContent(String(row.content ?? ''));
      const hay = content.toLowerCase();
      let rank = hay.includes(needle) ? 100 : 0;
      for (const w of words) if (hay.includes(w)) rank += 1;
      return {
        documentId: String(row.document_id),
        chunkIndex: Number(row.chunk_index),
        content,
        rank,
      };
    })
    .filter((r) => r.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.chunkIndex - b.chunkIndex)
    .slice(0, limit);
}

async function baselineVector(
  pool: pg.Pool,
  issueId: string,
  query: string,
  limit: number,
): Promise<RetrievedRow[]> {
  const emb = await embedNomic(query);
  const { rows } = await pool.query(
    `SELECT id, document_id, chunk_index, content, similarity FROM match_issue_document_chunks($1,$2::vector,$3)`,
    [issueId, `[${emb.join(',')}]`, limit],
  );
  return rows.map((row) => ({
    chunkId: String(row.id),
    documentId: String(row.document_id),
    chunkIndex: Number(row.chunk_index),
    content: clipContent(String(row.content ?? '')),
    rank: Number(row.similarity),
  }));
}

function mergeChunks(primary: RetrievedRow[], secondary: RetrievedRow[], limit: number): RetrievedRow[] {
  const seen = new Set<string>();
  const out: RetrievedRow[] = [];
  for (const chunk of [...primary, ...secondary]) {
    const key = `${chunk.documentId}:${chunk.chunkIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(chunk);
    if (out.length >= limit) break;
  }
  return out;
}

async function searchIssueIds(pool: pg.Pool, variant: EvalVariant, query: string, limit: number): Promise<string[]> {
  if (variant === 'baseline') {
    const pattern = `%${query.slice(0, 80)}%`;
    const { rows } = await pool.query(
      `SELECT id FROM stortinget_issues WHERE title ILIKE $1 OR summary ILIKE $1 OR henvisning ILIKE $1 LIMIT $2`,
      [pattern, limit],
    );
    return rows.map((r) => String(r.id));
  }
  const terms = buildSearchTerms(query);
  const { rows } = await pool.query(`SELECT id FROM search_issues_fts($1, $2::text[], $3)`, [query, terms, limit]);
  return rows.map((r) => String(r.id));
}

export async function retrieveForQuestion(
  pool: pg.Pool,
  variant: EvalVariant,
  args: {
    kind: string;
    query: string;
    issueId?: string;
    hearingId?: string;
    issueIds?: string[];
    k: number;
    useLegacyExcerptBug?: boolean;
  },
): Promise<{ rows: RetrievedRow[]; excerpts: RetrievedRow[]; topicBySak?: RetrievedRow[][]; ms: number }> {
  const start = performance.now();
  const limit = Math.max(args.k, MAX_CHUNKS);

  const maxPerDocument = Number(process.env.RAG_EVAL_MAX_CHUNKS_PER_DOCUMENT ?? '1');
  const dedupeRows = (rows: RetrievedRow[]) =>
    maxPerDocument > 0 ? capChunksPerDocument(rows, maxPerDocument) : rows;

  const excerptRows = (rows: RetrievedRow[], query: string): RetrievedRow[] => {
    const input = dedupeRows(rows);
    if (args.useLegacyExcerptBug) {
      const sorted = [...input].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
      return applyChunkExcerptsForChat(sorted, query);
    }
    return applyChunkExcerptsForChat(input, query);
  };

  if ((args.kind === 'topic' || args.kind === 'hearing_topic') && variant === 'stack') {
    const ids =
      args.issueIds && args.issueIds.length > 0
        ? args.issueIds
        : await searchIssueIds(pool, variant, args.query, 3);
    const perSak: RetrievedRow[][] = [];
    for (const id of ids) {
      const raw =
        args.kind === 'hearing_topic'
          ? await hybridSearch(pool, args.query, { hearingId: id }, 8)
          : await hybridSearch(pool, args.query, { issueIds: [id] }, 8);
      perSak.push(dedupeRows(raw));
    }
    const excerptedBySak = applyTopicWideChunkExcerpts(perSak, args.query);
    const flatExcerpts = excerptedBySak.flat();
    const flatRows = perSak.flat();
    return {
      rows: flatRows,
      excerpts: flatExcerpts,
      topicBySak: excerptedBySak,
      ms: performance.now() - start,
    };
  }

  if (args.kind === 'hearing_chunk' && variant === 'stack' && args.hearingId) {
    const rows = await hybridSearch(pool, args.query, { hearingId: args.hearingId }, limit);
    return { rows, excerpts: excerptRows(rows, args.query), ms: performance.now() - start };
  }

  if (args.kind === 'sak_chunk' && args.issueId) {
    const issue: ChatIssueHit = {
      id: args.issueId,
      title: null,
      summary: null,
      henvisning: null,
      ferdigbehandlet: null,
    };
    if (variant === 'stack') {
      const rows = await hybridSearch(pool, args.query, { issueIds: [args.issueId] }, limit);
      return { rows, excerpts: excerptRows(rows, args.query), ms: performance.now() - start };
    }
    const rows = mergeChunks(
      await baselineVector(pool, args.issueId, args.query, limit),
      await baselineLexical(pool, issue, args.query, limit),
      limit,
    );
    return { rows, excerpts: excerptRows(rows, args.query), ms: performance.now() - start };
  }

  if (args.kind === 'finnes_ikke') {
    const issueId = args.issueId ?? '103102';
    if (variant === 'stack') {
      const hearingId = args.hearingId;
      const rows = await hybridSearch(
        pool,
        args.query,
        hearingId ? { hearingId } : { issueIds: [issueId] },
        limit,
      );
      const excerpts = excerptRows(rows, args.query);
      const gated = await applyRetrievalGate(args.query, rows, excerpts);
      return { ...gated, ms: performance.now() - start };
    }
    const issue: ChatIssueHit = {
      id: issueId,
      title: null,
      summary: null,
      henvisning: null,
      ferdigbehandlet: null,
    };
    const rows = await baselineLexical(pool, issue, args.query, limit);
    return { rows, excerpts: rows, ms: performance.now() - start };
  }

  return { rows: [], excerpts: [], ms: performance.now() - start };
}
