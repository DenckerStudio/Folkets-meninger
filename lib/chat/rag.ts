import type { SupabaseClient } from '@supabase/supabase-js';
import { getAnonSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';

const MAX_CHUNK_CHARS = 1400;
const MAX_CHUNKS = 8;
const ISSUE_COLUMNS = 'id, title, summary, henvisning, ferdigbehandlet';
const CHUNK_COLUMNS = 'issue_id, document_id, chunk_index, content';

export type ChatRagClient = Pick<SupabaseClient, 'from'>;

export type ChatDocumentChunk = {
  documentId: string;
  chunkIndex: number;
  content: string;
  rank?: number;
};

export type ChatIssueHit = {
  id: string;
  title: string | null;
  summary: string | null;
  henvisning: string | null;
  ferdigbehandlet: boolean | null;
};

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

function clip(value: string, max = MAX_CHUNK_CHARS): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
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

const SAK_STOPWORDS = new Set([
  'om',
  'for',
  'og',
  'i',
  'av',
  'til',
  'en',
  'et',
  'den',
  'det',
  'de',
  'som',
  'er',
  'på',
  'med',
  'fra',
  'ved',
  'eller',
  'men',
  'ikke',
  'skal',
  'kan',
  'vil',
  'har',
  'var',
  'lov',
  'endringer',
  'forslag',
  'representantforslag',
  'stortinget',
  'innstilling',
  'proposisjon',
  'dokument',
]);

function rankText(content: string, query: string): number {
  const needle = query.toLowerCase().trim();
  if (!needle) return 0;
  const haystack = content.toLowerCase();
  if (haystack.includes(needle)) return 100;
  const words = needle.split(/\s+/).filter((word) => word.length > 2);
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

/** Contentful tokens from sak title/henvisning — skip boilerplate so multi-sak referater do not “match” on “lov/forslag”. */
function significantSakTokens(...parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const raw of part.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      const word = raw.trim();
      if (word.length < 4 || SAK_STOPWORDS.has(word) || seen.has(word)) continue;
      seen.add(word);
      out.push(word);
    }
  }
  return out;
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

  for (const token of significantSakTokens(issue.title, issue.henvisning)) {
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
 * key fail-closes, and the lexical RPCs are service_role-only.
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

export async function searchIssuesForChat(
  query: string,
  limit = 6,
  client?: ChatRagClient | null,
): Promise<ChatIssueHit[]> {
  const supabase = await resolveChatRagClient(client);
  const needle = query.trim().slice(0, 80);
  if (!supabase || !needle) return [];

  const pattern = `%${escapeIlike(needle)}%`;
  const [byId, byTitle, byHenvisning, bySummary] = await Promise.all([
    supabase.from('stortinget_issues').select(ISSUE_COLUMNS).eq('id', needle).maybeSingle(),
    supabase.from('stortinget_issues').select(ISSUE_COLUMNS).ilike('title', pattern).limit(limit),
    supabase
      .from('stortinget_issues')
      .select(ISSUE_COLUMNS)
      .ilike('henvisning', pattern)
      .limit(limit),
    supabase.from('stortinget_issues').select(ISSUE_COLUMNS).ilike('summary', pattern).limit(limit),
  ]);

  const seen = new Set<string>();
  const hits: ChatIssueHit[] = [];
  const rows = [
    byId.data,
    ...(Array.isArray(byTitle.data) ? byTitle.data : []),
    ...(Array.isArray(byHenvisning.data) ? byHenvisning.data : []),
    ...(Array.isArray(bySummary.data) ? bySummary.data : []),
  ];

  for (const row of rows) {
    const issue = mapIssue(row as Record<string, unknown> | null);
    if (!issue || seen.has(issue.id)) continue;
    seen.add(issue.id);
    hits.push(issue);
    if (hits.length >= limit) break;
  }

  return hits;
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

async function searchChunks(
  supabase: ChatRagClient,
  issue: ChatIssueHit,
  query: string,
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
    const content = clip(String(row.content ?? ''));
    if (!content) return [];
    const rank = rankChunkForSak(content, issue, query);
    if (rank <= 0) return [];
    return [
      {
        documentId: String(row.document_id ?? ''),
        chunkIndex: Number(row.chunk_index ?? 0),
        content,
        rank,
      },
    ];
  });

  return [...mapped]
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0) || a.chunkIndex - b.chunkIndex)
    .slice(0, MAX_CHUNKS);
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
    searchChunks(supabase, issue, args.query),
    loadAiSummaryText(supabase, issueId),
  ]);

  return {
    issue,
    summary: clip(summaryText || issue.summary || '', 1800) || null,
    chunks,
    note:
      chunks.length === 0
        ? 'Ingen dokumentutdrag som handler om denne saken er indeksert ennå. Bruk tittel/sammendrag, og søk etter oppdaterte kilder ved behov.'
        : null,
  };
}
