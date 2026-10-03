import { getAiSummaryFromDb } from '@/lib/ai-summary/service';
import { getServiceSupabase } from '@/lib/supabase';

const MAX_CHUNK_CHARS = 1400;
const MAX_CHUNKS = 8;

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

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function clip(value: string, max = MAX_CHUNK_CHARS): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function searchIssuesForChat(query: string, limit = 6): Promise<ChatIssueHit[]> {
  if (!supabaseConfigured()) return [];
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('search_stortinget_issues_for_chat', {
    p_query: query,
    p_limit: limit,
  });
  if (error || !Array.isArray(data)) return [];

  return data.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string') return [];
    return [
      {
        id: r.id,
        title: typeof r.title === 'string' ? r.title : null,
        summary: typeof r.summary === 'string' ? r.summary : null,
        henvisning: typeof r.henvisning === 'string' ? r.henvisning : null,
        ferdigbehandlet: typeof r.ferdigbehandlet === 'boolean' ? r.ferdigbehandlet : null,
      },
    ];
  });
}

export async function loadIssueMeta(issueId: string): Promise<ChatIssueHit | null> {
  if (!supabaseConfigured()) return null;
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('stortinget_issues')
    .select('id, title, summary, henvisning, ferdigbehandlet')
    .eq('id', issueId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: String(data.id),
    title: data.title ? String(data.title) : null,
    summary: data.summary ? String(data.summary) : null,
    henvisning: data.henvisning ? String(data.henvisning) : null,
    ferdigbehandlet: typeof data.ferdigbehandlet === 'boolean' ? data.ferdigbehandlet : null,
  };
}

async function searchChunks(issueId: string, query: string): Promise<ChatDocumentChunk[]> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('search_issue_document_chunks_text', {
    p_issue_id: issueId,
    p_query: query,
    p_match_count: MAX_CHUNKS,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    return data.flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const r = row as Record<string, unknown>;
      const content = typeof r.content === 'string' ? clip(r.content) : '';
      if (!content) return [];
      return [
        {
          documentId: typeof r.document_id === 'string' ? r.document_id : '',
          chunkIndex: typeof r.chunk_index === 'number' ? r.chunk_index : 0,
          content,
          rank: typeof r.rank === 'number' ? r.rank : undefined,
        },
      ];
    });
  }

  const { data: fallback, error: fallbackError } = await service
    .from('document_chunks')
    .select('document_id, chunk_index, content')
    .eq('issue_id', issueId)
    .order('chunk_index', { ascending: true })
    .limit(MAX_CHUNKS);

  if (fallbackError || !fallback) return [];
  return fallback.flatMap((row) => {
    const content = clip(String(row.content ?? ''));
    if (!content) return [];
    return [
      {
        documentId: String(row.document_id ?? ''),
        chunkIndex: Number(row.chunk_index ?? 0),
        content,
      },
    ];
  });
}

export async function retrieveSakContext(args: {
  issueId?: string | null;
  query: string;
}): Promise<ChatSakContext> {
  if (!supabaseConfigured()) {
    return {
      issue: null,
      summary: null,
      chunks: [],
      note: 'Sakdata er ikke konfigurert i dette miljøet.',
    };
  }

  let issueId = args.issueId?.trim() || null;
  let issue = issueId ? await loadIssueMeta(issueId) : null;

  if (!issue && args.query.trim()) {
    const hits = await searchIssuesForChat(args.query, 3);
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

  const [chunks, aiSummary] = await Promise.all([
    searchChunks(issueId, args.query),
    getAiSummaryFromDb(issueId),
  ]);

  const summaryText =
    aiSummary && 'narrative' in aiSummary
      ? aiSummary.narrative
      : aiSummary && 'hva' in aiSummary
        ? [aiSummary.hva, aiSummary.hvem, aiSummary.kostnad].filter(Boolean).join('\n')
        : issue.summary;

  return {
    issue,
    summary: summaryText ? clip(summaryText, 1800) : null,
    chunks,
    note:
      chunks.length === 0
        ? 'Ingen dokumentutdrag er indeksert for denne saken ennå. Bruk tittel/sammendrag, og søk etter oppdaterte kilder ved behov.'
        : null,
  };
}
