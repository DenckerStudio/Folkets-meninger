import type { ChatDocumentChunk, ChatIssueHit } from '@/lib/chat/rag';
import type pg from 'pg';
import { embedBgeM3, embedNomic } from './embed';
import { applyChunkExcerptsForChat, clipChunkContent, type ExcerptMode } from './excerpt';
import type { EvalVariant } from './db';

export type RetrievedRow = ChatDocumentChunk & { chunkId?: string };

const MAX_CHUNKS = 10;

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
    [
      query,
      vector,
      filters.issueIds ?? null,
      filters.hearingId ?? null,
      limit,
    ],
  );
  return rows.map((row) => ({
    chunkId: String(row.id),
    documentId: String(row.document_id),
    chunkIndex: Number(row.chunk_index),
    content: clipChunkContent(String(row.content ?? '')),
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
  const scored = rows
    .map((row) => {
      const content = clipChunkContent(String(row.content ?? ''));
      const hay = content.toLowerCase();
      let rank = hay.includes(needle) ? 100 : 0;
      for (const w of words) if (hay.includes(w)) rank += 1;
      return {
        documentId: String(row.document_id),
        chunkIndex: Number(row.chunk_index),
        content,
        rank,
        metadata: row.metadata,
      };
    })
    .filter((r) => r.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.chunkIndex - b.chunkIndex)
    .slice(0, limit);
  return scored.map((r) => ({
    documentId: r.documentId,
    chunkIndex: r.chunkIndex,
    content: r.content,
    rank: r.rank,
  }));
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
    content: clipChunkContent(String(row.content ?? '')),
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

export async function retrieveForQuestion(
  pool: pg.Pool,
  variant: EvalVariant,
  args: {
    kind: string;
    query: string;
    issueId?: string;
    hearingId?: string;
    excerptMode: ExcerptMode;
    k: number;
  },
): Promise<{ rows: RetrievedRow[]; excerpts: RetrievedRow[]; issueHits?: ChatIssueHit[]; ms: number }> {
  const start = performance.now();
  const limit = Math.max(args.k, MAX_CHUNKS);

  if (args.kind === 'hearing_chunk' && variant === 'stack' && args.hearingId) {
    const rows = await hybridSearch(pool, args.query, { hearingId: args.hearingId }, limit);
    const excerpts = applyChunkExcerptsForChat(rows, args.excerptMode);
    return { rows, excerpts, ms: performance.now() - start };
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
      const excerpts = applyChunkExcerptsForChat(rows, args.excerptMode);
      return { rows, excerpts, ms: performance.now() - start };
    }
    const lexical = await baselineLexical(pool, issue, args.query, limit);
    const semantic = await baselineVector(pool, args.issueId, args.query, limit);
    const rows = mergeChunks(semantic, lexical, limit);
    const excerpts = applyChunkExcerptsForChat(rows, 'stack_buggy');
    return { rows, excerpts, ms: performance.now() - start };
  }

  if (args.kind === 'finnes_ikke') {
    const issueId = args.issueId ?? '103102';
    if (variant === 'stack') {
      const rows = await hybridSearch(pool, args.query, { issueIds: [issueId] }, limit);
      const excerpts = applyChunkExcerptsForChat(rows, args.excerptMode);
      return { rows, excerpts, ms: performance.now() - start };
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
