import type { SupabaseClient } from '@supabase/supabase-js';
import { getAnonSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  buildSearchTerms,
  escapeIlike,
  looksLikeIssueId,
  rankSakRows,
  significantTokens,
  type SakSearchRow,
} from '@/lib/chat/sak-search';
import { fetchCentralQueryEmbedding } from '@/lib/chat/query-embed';
import {
  applyChunkExcerptsForChat,
  capChunksPerDocument,
  applyTopicWideChunkExcerpts,
  normalizeChunkText,
} from '@/lib/chat/chunk-excerpt';
import {
  searchChunksByVector,
  type QueryVectorizer,
  type VectorSearchClient,
} from '@/lib/chat/vector-search';
import { rerankCandidates, rerankerEnabled, shouldRejectRetrieval } from '@/lib/chat/rerank';

const MAX_CHUNKS = 8;
const MAX_SUMMARY_CLIP_CHARS = 1800;
const ISSUE_COLUMNS = 'id, title, summary, henvisning, ferdigbehandlet';
// `metadata` carries document_title/document_kind set during ingest — cheap
// provenance so citations can name their source document.
const CHUNK_COLUMNS = 'issue_id, document_id, chunk_index, content, metadata';

export type ChatRagClient = Pick<SupabaseClient, 'from' | 'rpc'>;

export type ChatDocumentChunk = {
  documentId: string;
  chunkIndex: number;
  content: string;
  documentTitle?: string | null;
  documentKind?: string | null;
  sourceUrl?: string | null;
  rank?: number;
};

export type ChatIssueHit = {
  id: string;
  title: string | null;
  summary: string | null;
  henvisning: string | null;
  ferdigbehandlet: boolean | null;
};

/** Document title/kind live in `document_chunks.metadata`; tolerate any shape. */
function chunkProvenance(metadata: unknown): {
  documentTitle: string | null;
  documentKind: string | null;
} {
  if (!metadata || typeof metadata !== 'object') {
    return { documentTitle: null, documentKind: null };
  }
  const meta = metadata as { document_title?: unknown; document_kind?: unknown };
  const title = typeof meta.document_title === 'string' ? meta.document_title.trim() : '';
  const kind = typeof meta.document_kind === 'string' ? meta.document_kind.trim() : '';
  return {
    documentTitle: title || null,
    documentKind: kind || null,
  };
}

export type ChatSakContext = {
  issue: ChatIssueHit | null;
  summary: string | null;
  chunks: ChatDocumentChunk[];
  note: string | null;
};

function publicSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

function clipSummary(value: string, max = MAX_SUMMARY_CLIP_CHARS): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function mapIssue(row: Record<string, unknown> | null | undefined): ChatIssueHit | null {
  if (!row || typeof row.id !== 'string') return null;
  return {
    id: row.id,
    title: typeof row.title === 'string' ? row.title : null,
    summary: typeof row.summary === 'string' ? row.summary : null,
    henvisning: typeof row.henvisning === 'string' ? row.henvisning : null,
    ferdigbehandlet: typeof row.ferdigbehandlet === 'boolean' ? row.ferdigbehandlet : null,
  };
}

function mapIssueRow(row: Record<string, unknown> | null | undefined): SakSearchRow | null {
  const issue = mapIssue(row);
  if (!issue) return null;
  return {
    id: issue.id,
    title: issue.title,
    summary: issue.summary,
    henvisning: issue.henvisning,
    ferdigbehandlet: issue.ferdigbehandlet,
  };
}

function rankText(content: string, query: string): number {
  const needle = query.toLowerCase().trim();
  if (!needle) return 0;
  const haystack = content.toLowerCase();
  if (haystack.includes(needle)) return 100;
  const words = needle.split(/\s+/).filter((word) => word.length > 2);
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

/**
 * Score a chunk against the requested sak. Multi-sak meeting minutes often share
 * one document_id; never treat “first chunk of the referat” as sak-relevant.
 */
function rankChunkForSak(
  content: string,
  issue: ChatIssueHit,
  userQuery: string,
): number {
  const haystack = content.toLowerCase();
  let score = 0;

  const issueId = issue.id.trim().toLowerCase();
  if (issueId && haystack.includes(issueId)) score += 100;

  const henvisning = issue.henvisning?.trim().toLowerCase();
  if (henvisning && henvisning.length >= 4 && haystack.includes(henvisning)) {
    score += 80;
  }

  for (const token of significantTokens(issue.title, issue.henvisning)) {
    if (haystack.includes(token)) score += 10;
  }

  const query = userQuery.trim();
  if (query && query.toLowerCase() !== issueId) {
    score += rankText(content, query);
  }

  return score;
}

/**
 * Overlay chat RAG uses the logged-in request session when present, then the
 * public anon key. Public sak cache tables already allow SELECT for
 * anon/authenticated. Do not use the service role — a mismatched Cloud Agent
 * key fail-closes. Hybrid FTS RPCs run as SECURITY INVOKER with anon/session.
 */
export async function resolveChatRagClient(
  explicit?: ChatRagClient | null,
): Promise<ChatRagClient | null> {
  if (explicit) return explicit;
  if (!publicSupabaseConfigured()) return null;
  try {
    return await getServerSupabase();
  } catch {
    return getAnonSupabase();
  }
}

/**
 * Find saker from a free-text question. Splits the question into significant
 * terms, ORs them across title/henvisning/summary, then ranks by relevance in
 * `sak-search.ts`. Falls back to the old phrase search so nothing regresses.
 */
export function isMissingHybridRpcError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('schema cache') ||
    msg.includes('permission denied')
  );
}

export function shouldFallbackToLegacyIssueSearch(ftsHits: ChatIssueHit[] | null): boolean {
  return ftsHits === null || ftsHits.length === 0;
}

export async function primaryIssuesFromFtsAttempt(
  ftsHits: ChatIssueHit[] | null,
  loadLegacy: () => Promise<ChatIssueHit[]>,
): Promise<ChatIssueHit[]> {
  if (ftsHits !== null && ftsHits.length > 0) return ftsHits;
  return loadLegacy();
}

async function searchIssuesViaFts(
  supabase: ChatRagClient,
  needle: string,
  limit: number,
): Promise<ChatIssueHit[] | null> {
  if (!supabase.rpc) return null;
  try {
    const { data, error } = await supabase.rpc('search_issues_fts', {
      query_text: needle,
      search_terms: buildSearchTerms(needle),
      match_count: limit,
    });
    if (error) {
      if (isMissingHybridRpcError(error)) return null;
      return null;
    }
    if (!Array.isArray(data)) return null;
    const mapped = data.flatMap((row) => {
      const issue = mapIssue(row as Record<string, unknown>);
      return issue ? [issue] : [];
    });
    return mapped.length > 0 ? mapped : null;
  } catch {
    return null;
  }
}

async function searchIssuesForChatLegacy(
  supabase: ChatRagClient,
  needle: string,
  limit: number,
): Promise<ChatIssueHit[]> {
  const candidates: Array<Record<string, unknown> | null> = [];
  const perTermLimit = Math.min(Math.max(limit * 3, 12), 40);

  // Exact-id lookup stays for numeric input, then union the per-term matches.
  if (looksLikeIssueId(needle)) {
    const byId = await supabase
      .from('stortinget_issues')
      .select(ISSUE_COLUMNS)
      .eq('id', needle)
      .maybeSingle();
    if (byId.data) candidates.push(byId.data as Record<string, unknown>);
  }

  const terms = buildSearchTerms(needle);
  if (terms.length > 0) {
    const perTerm = await Promise.all(
      terms.map(async (term) => {
        const pattern = `%${escapeIlike(term)}%`;
        const [byTitle, byHenvisning, bySummary] = await Promise.all([
          supabase
            .from('stortinget_issues')
            .select(ISSUE_COLUMNS)
            .ilike('title', pattern)
            .limit(perTermLimit),
          supabase
            .from('stortinget_issues')
            .select(ISSUE_COLUMNS)
            .ilike('henvisning', pattern)
            .limit(perTermLimit),
          supabase
            .from('stortinget_issues')
            .select(ISSUE_COLUMNS)
            .ilike('summary', pattern)
            .limit(perTermLimit),
        ]);
        return [
          ...(Array.isArray(byTitle.data) ? byTitle.data : []),
          ...(Array.isArray(byHenvisning.data) ? byHenvisning.data : []),
          ...(Array.isArray(bySummary.data) ? bySummary.data : []),
        ] as Array<Record<string, unknown>>;
      }),
    );
    for (const group of perTerm) candidates.push(...group);
  }

  // Whole-phrase search as a safety net (matches when terms individually miss).
  const phrasePattern = `%${escapeIlike(needle.slice(0, 80))}%`;
  const [byTitle, byHenvisning, bySummary] = await Promise.all([
    supabase.from('stortinget_issues').select(ISSUE_COLUMNS).ilike('title', phrasePattern).limit(limit),
    supabase
      .from('stortinget_issues')
      .select(ISSUE_COLUMNS)
      .ilike('henvisning', phrasePattern)
      .limit(limit),
    supabase.from('stortinget_issues').select(ISSUE_COLUMNS).ilike('summary', phrasePattern).limit(limit),
  ]);
  candidates.push(
    ...(Array.isArray(byTitle.data) ? byTitle.data : []),
    ...(Array.isArray(byHenvisning.data) ? byHenvisning.data : []),
    ...(Array.isArray(bySummary.data) ? bySummary.data : []),
  );

  const rows = candidates
    .map((row) => mapIssueRow(row))
    .filter((row): row is SakSearchRow => row !== null);

  // Rank purely; drop the exact-id candidate if it did not match any term/phrase.
  const ranked = rankSakRows(rows, terms.length > 0 ? terms : [needle], needle, limit);

  return ranked.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    henvisning: row.henvisning,
    ferdigbehandlet: row.ferdigbehandlet,
  }));
}

export async function searchIssuesForChat(
  query: string,
  limit = 6,
  client?: ChatRagClient | null,
): Promise<ChatIssueHit[]> {
  const supabase = await resolveChatRagClient(client);
  const needle = query.trim().slice(0, 120);
  if (!supabase || !needle) return [];

  if (looksLikeIssueId(needle)) {
    const direct = await loadIssueMeta(needle, supabase);
    if (direct) return [direct];
  }

  const ftsHits = await searchIssuesViaFts(supabase, needle, limit);
  return primaryIssuesFromFtsAttempt(ftsHits, () =>
    searchIssuesForChatLegacy(supabase, needle, limit),
  );
}

export async function loadIssueMeta(
  issueId: string,
  client?: ChatRagClient | null,
): Promise<ChatIssueHit | null> {
  const supabase = await resolveChatRagClient(client);
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('stortinget_issues')
    .select(ISSUE_COLUMNS)
    .eq('id', issueId)
    .maybeSingle();

  if (error || !data) return null;
  return mapIssue(data as Record<string, unknown>);
}

/** Narrow the resolved cache client to the rpc surface vector search needs. */
function asVectorClient(client: ChatRagClient): VectorSearchClient {
  return client as unknown as VectorSearchClient;
}

/** Merge semantic + lexical chunks, de-duplicating on document position. */
export function mergeChunks(
  primary: readonly ChatDocumentChunk[],
  secondary: readonly ChatDocumentChunk[],
  limit = MAX_CHUNKS,
): ChatDocumentChunk[] {
  const seen = new Set<string>();
  const out: ChatDocumentChunk[] = [];
  for (const chunk of [...primary, ...secondary]) {
    const key = `${chunk.documentId}:${chunk.chunkIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(chunk);
    if (out.length >= limit) break;
  }
  return out;
}

export function mapHybridChunkRow(row: Record<string, unknown>): ChatDocumentChunk | null {
  const content = normalizeChunkText(String(row.content ?? ''));
  if (!content) return null;
  const documentId = String(row.document_id ?? '');
  if (!documentId) return null;
  const fused = Number(row.score_fused ?? 0);
  const lexical = row.score_lexical != null ? Number(row.score_lexical) : null;
  const rank = Number.isFinite(fused) && fused > 0 ? fused : lexical ?? 0;
  const sourceUrl =
    typeof row.source_url === 'string' && row.source_url.trim() ? row.source_url.trim() : null;
  const documentTitle =
    typeof row.document_title === 'string' && row.document_title.trim()
      ? row.document_title.trim()
      : null;
  const documentKind =
    typeof row.document_kind === 'string' && row.document_kind.trim()
      ? row.document_kind.trim()
      : null;
  return {
    documentId,
    chunkIndex: Number(row.chunk_index ?? 0),
    content,
    documentTitle,
    documentKind,
    sourceUrl,
    rank,
  };
}

/** Hybrid RPC succeeded but returned no usable chunks — fall back to legacy scan. */
export function shouldFallbackToLegacyChunks(hybrid: ChatDocumentChunk[] | null): boolean {
  return hybrid === null || hybrid.length === 0;
}

export async function primaryChunksFromHybridAttempt(
  hybrid: ChatDocumentChunk[] | null,
  loadLegacy: () => Promise<ChatDocumentChunk[]>,
): Promise<ChatDocumentChunk[]> {
  if (hybrid !== null && hybrid.length > 0) return hybrid;
  return loadLegacy();
}

async function searchChunksHybrid(
  supabase: ChatRagClient,
  issue: ChatIssueHit,
  query: string,
  maxChunks: number = MAX_CHUNKS,
  centralQueryEmbedding?: number[] | null,
): Promise<ChatDocumentChunk[] | null> {
  if (!supabase.rpc) return null;
  const issueId = issue.id.trim();
  if (!issueId) return null;

  const queryEmbedding =
    centralQueryEmbedding !== undefined
      ? centralQueryEmbedding
      : await fetchCentralQueryEmbedding(query);

  try {
    const { data, error } = await supabase.rpc('search_chunks_hybrid', {
      query_text: query,
      query_embedding: queryEmbedding,
      filter_issue_ids: [issueId],
      filter_document_kinds: null,
      filter_sesjon: null,
      filter_komite: null,
      filter_ferdigbehandlet: null,
      filter_published_after: null,
      filter_hearing_id: null,
      match_count: maxChunks,
    });
    if (error) {
      if (isMissingHybridRpcError(error)) return null;
      return null;
    }
    if (!Array.isArray(data)) return null;
    const mapped = data.flatMap((row) => {
      const chunk = mapHybridChunkRow(row as Record<string, unknown>);
      return chunk ? [chunk] : [];
    });
    if (mapped.length === 0) return null;
    if (!rerankerEnabled() && !process.env.RAG_REJECTION_THRESHOLD) return mapped;
    const { scores } = await rerankCandidates(
      query,
      mapped.map((c) => ({ id: `${c.documentId}:${c.chunkIndex}`, content: c.content, fusedScore: c.rank })),
    );
    const best = scores.length ? Math.max(...scores) : 0;
    if (shouldRejectRetrieval(best)) return [];
    return mapped;
  } catch {
    return null;
  }
}

async function searchChunksLexical(
  supabase: ChatRagClient,
  issue: ChatIssueHit,
  query: string,
  maxChunks: number,
): Promise<ChatDocumentChunk[]> {
  const issueId = issue.id.trim();
  if (!issueId) return [];

  const { data, error } = await supabase
    .from('document_chunks')
    .select(CHUNK_COLUMNS)
    .eq('issue_id', issueId)
    .order('chunk_index', { ascending: true })
    .limit(40);

  if (error || !Array.isArray(data)) return [];

  const mapped = data.flatMap((row) => {
    const rowIssueId = String(row.issue_id ?? '').trim();
    // Defense in depth: never surface a chunk that is not for this sak.
    if (rowIssueId && rowIssueId !== issueId) return [];
    const content = normalizeChunkText(String(row.content ?? ''));
    if (!content) return [];
    const rank = rankChunkForSak(content, issue, query);
    if (rank <= 0) return [];
    return [
      {
        documentId: String(row.document_id ?? ''),
        chunkIndex: Number(row.chunk_index ?? 0),
        content,
        ...chunkProvenance(row.metadata),
        sourceUrl: null,
        rank,
      },
    ];
  });

  return [...mapped]
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0) || a.chunkIndex - b.chunkIndex)
    .slice(0, maxChunks);
}

type SearchChunksOptions = {
  /** When false, return merged full text (caller applies excerpt budget). */
  applyExcerpts?: boolean;
  /** Reuse one central embedding across topic saker (avoids duplicate Ollama calls). */
  centralQueryEmbedding?: number[] | null;
};

/**
 * Chunks for one sak: hybrid RPC when available, else legacy lexical scan; optional
 * BYOK Ollama semantic hits prepended via `mergeChunks`. Excerpt budgeting runs
 * last unless `applyExcerpts` is false (topic context shares one budget across saker).
 */
async function searchChunks(
  supabase: ChatRagClient,
  issue: ChatIssueHit,
  query: string,
  vectorize?: QueryVectorizer | null,
  maxChunks: number = MAX_CHUNKS,
  options: SearchChunksOptions = {},
): Promise<ChatDocumentChunk[]> {
  const applyExcerpts = options.applyExcerpts !== false;
  const finish = (chunks: ChatDocumentChunk[]) => {
    const deduped = capChunksPerDocument(chunks, 1);
    return applyExcerpts ? applyChunkExcerptsForChat(deduped, query) : deduped;
  };

  const hybrid = await searchChunksHybrid(
    supabase,
    issue,
    query,
    maxChunks,
    options.centralQueryEmbedding,
  );
  const primary = await primaryChunksFromHybridAttempt(hybrid, () =>
    searchChunksLexical(supabase, issue, query, maxChunks),
  );

  if (!vectorize) return finish(primary);

  const semantic = await searchChunksByVector(
    asVectorClient(supabase),
    issue.id,
    query,
    vectorize,
    maxChunks,
  );
  if (!semantic || semantic.length === 0) return finish(primary);

  // nomic (768-dim) path — unchanged until embedding_v2 is populated for all users.
  const provenance = await loadChunkProvenance(
    supabase,
    [...new Set(semantic.map((chunk) => chunk.documentId))],
  );

  const merged = mergeChunks(
    semantic.map((chunk) => ({
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      rank: chunk.similarity,
      sourceUrl: null,
      ...(provenance.get(chunk.documentId) ?? {}),
    })),
    primary,
    maxChunks,
  );

  return finish(merged);
}

/** Fetch document title/kind for a set of document ids in one query. */
async function loadChunkProvenance(
  supabase: ChatRagClient,
  documentIds: string[],
): Promise<Map<string, { documentTitle: string | null; documentKind: string | null }>> {
  const map = new Map<string, { documentTitle: string | null; documentKind: string | null }>();
  const ids = [...new Set(documentIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from('document_chunks')
    .select('document_id, metadata')
    .in('document_id', ids)
    .limit(ids.length * 12);

  if (error || !Array.isArray(data)) return map;

  for (const row of data) {
    const id = String(row.document_id ?? '');
    if (!id || map.has(id)) continue;
    const { documentTitle, documentKind } = chunkProvenance(row.metadata);
    map.set(id, { documentTitle, documentKind });
  }
  return map;
}

async function loadAiSummaryText(
  supabase: ChatRagClient,
  issueId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('issue_ai_summaries')
    .select('narrative, hva, hvem, kostnad')
    .eq('stortinget_issue_id', issueId)
    .maybeSingle();

  if (error || !data) return null;
  const narrative = typeof data.narrative === 'string' ? data.narrative.trim() : '';
  if (narrative) return narrative;
  const parts = [data.hva, data.hvem, data.kostnad]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());
  return parts.length > 0 ? parts.join('\n') : null;
}

export async function retrieveSakContext(args: {
  issueId?: string | null;
  query: string;
  client?: ChatRagClient | null;
  vectorize?: QueryVectorizer | null;
}): Promise<ChatSakContext> {
  const supabase = await resolveChatRagClient(args.client);
  if (!supabase) {
    return {
      issue: null,
      summary: null,
      chunks: [],
      note: 'Sakdata er ikke konfigurert i dette miljøet.',
    };
  }

  let issueId = args.issueId?.trim() || null;
  let issue = issueId ? await loadIssueMeta(issueId, supabase) : null;

  if (!issue && args.query.trim()) {
    const hits = await searchIssuesForChat(args.query, 3, supabase);
    if (hits[0]) {
      issue = hits[0];
      issueId = hits[0].id;
    }
  }

  if (!issue || !issueId) {
    return {
      issue: null,
      summary: null,
      chunks: [],
      note: 'Fant ingen matching sak i vår cache. Prøv med sak-id eller en mer konkret tittel.',
    };
  }

  const [chunks, summaryText] = await Promise.all([
    searchChunks(supabase, issue, args.query, args.vectorize),
    loadAiSummaryText(supabase, issueId),
  ]);

  return {
    issue,
    summary: clipSummary(summaryText || issue.summary || '') || null,
    chunks,
    note:
      chunks.length === 0
        ? 'Ingen dokumentutdrag som handler om denne saken er indeksert ennå. Bruk tittel/sammendrag, og søk etter oppdaterte kilder ved behov.'
        : null,
  };
}

export type ChatTopicSak = {
  issue: ChatIssueHit;
  summary: string | null;
  chunks: ChatDocumentChunk[];
};

export type ChatTopicContext = {
  query: string;
  saker: ChatTopicSak[];
  note: string | null;
};

const MAX_TOPIC_SAKER = 3;
const MAX_TOPIC_CHUNKS = 4;
const MAX_TOPIC_SUMMARY_CHARS = 1200;

/**
 * Gather context from several relevant saker for a broad, topic-level question so
 * the model can synthesise across them instead of only one sak. Each sak keeps its
 * own chunks; nothing is merged across saker (meeting-minutes chunks often share a
 * document_id across saker).
 */
export async function retrieveTopicContext(args: {
  query: string;
  limit?: number;
  client?: ChatRagClient | null;
  vectorize?: QueryVectorizer | null;
}): Promise<ChatTopicContext> {
  const supabase = await resolveChatRagClient(args.client);
  const query = (args.query ?? '').trim();
  if (!supabase || !query) {
    return { query, saker: [], note: 'Sakdata er ikke konfigurert i dette miljøet.' };
  }

  const limit = Math.min(Math.max(args.limit ?? MAX_TOPIC_SAKER, 1), 5);
  const hits = await searchIssuesForChat(query, limit, supabase);
  if (hits.length === 0) {
    return {
      query,
      saker: [],
      note: 'Fant ingen matching saker i vår cache. Prøv en mer konkret tittel eller et kildesøk.',
    };
  }

  const centralQueryEmbedding = await fetchCentralQueryEmbedding(query);

  const saker = await Promise.all(
    hits.map(async (issue) => {
      const [chunks, summaryText] = await Promise.all([
        searchChunks(supabase, issue, query, args.vectorize, MAX_TOPIC_CHUNKS, {
          applyExcerpts: false,
          centralQueryEmbedding,
        }),
        loadAiSummaryText(supabase, issue.id),
      ]);
      return {
        issue,
        summary: clipSummary(summaryText || issue.summary || '', MAX_TOPIC_SUMMARY_CHARS) || null,
        chunks,
      };
    }),
  );

  const excerptedBySak = applyTopicWideChunkExcerpts(
    saker.map((sak) => sak.chunks),
    query,
  );
  const sakerWithBudget = saker.map((sak, index) => ({
    ...sak,
    chunks: excerptedBySak[index] ?? [],
  }));

  const hasChunks = sakerWithBudget.some((sak) => sak.chunks.length > 0);
  return {
    query,
    saker: sakerWithBudget,
    note: hasChunks
      ? null
      : 'Ingen dokumentutdrag er indeksert for disse sakene ennå. Bruk tittel/sammendrag og et kildesøk ved behov.',
  };
}
