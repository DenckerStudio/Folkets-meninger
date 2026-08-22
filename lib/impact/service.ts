import { getServiceSupabase } from '@/lib/supabase';
import { getAiSummaryFromDb } from '@/lib/ai-summary/service';
import { synthesizeImpact } from './synthesize';
import type { ImpactChunk, ImpactProfile, ImpactResult } from './types';

const MAX_CHUNKS = 80;
const MAX_CHUNK_CHARS = 1600;
const MAX_SOURCE_CHARS = 12_000;

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function splitSourceContext(text: string): ImpactChunk[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const parts: ImpactChunk[] = [];
  let offset = 0;
  let index = 0;
  while (offset < normalized.length && parts.length < 12) {
    parts.push({
      documentId: 'sak-kilde',
      chunkIndex: index,
      content: normalized.slice(offset, offset + MAX_CHUNK_CHARS),
    });
    offset += MAX_CHUNK_CHARS;
    index += 1;
  }
  return parts;
}

export async function loadIssueImpactChunks(issueId: string): Promise<{
  chunks: ImpactChunk[];
  title: string | null;
  summary: string | null;
}> {
  if (!supabaseConfigured()) return { chunks: [], title: null, summary: null };

  try {
    const supabase = getServiceSupabase();
    const [{ data: chunkRows, error: chunkError }, { data: issue }] = await Promise.all([
      supabase
        .from('document_chunks')
        .select('document_id, chunk_index, content')
        .eq('issue_id', issueId)
        .order('chunk_index', { ascending: true })
        .limit(MAX_CHUNKS),
      supabase
        .from('stortinget_issues')
        .select('title, summary, ai_summary_source_context')
        .eq('id', issueId)
        .maybeSingle(),
    ]);

    const chunks: ImpactChunk[] = [];
    if (!chunkError && chunkRows) {
      for (const row of chunkRows) {
        const content = String(row.content ?? '').slice(0, MAX_CHUNK_CHARS).trim();
        if (!content) continue;
        chunks.push({
          documentId: String(row.document_id ?? ''),
          chunkIndex: Number(row.chunk_index ?? 0),
          content,
        });
      }
    }

    const source = String(issue?.ai_summary_source_context ?? '').slice(0, MAX_SOURCE_CHARS);
    if (chunks.length === 0 && source) {
      chunks.push(...splitSourceContext(source));
    }

    return {
      chunks,
      title: issue?.title ? String(issue.title) : null,
      summary: issue?.summary ? String(issue.summary) : null,
    };
  } catch (error) {
    console.error('[impact] Kunne ikke hente dokumentutdrag:', error);
    return { chunks: [], title: null, summary: null };
  }
}

export async function calculateSakImpact(
  issueId: string,
  profile: ImpactProfile,
  extras?: { title?: string | null; summary?: string | null },
): Promise<ImpactResult> {
  const [{ chunks, title, summary: issueSummary }, summary] = await Promise.all([
    loadIssueImpactChunks(issueId),
    getAiSummaryFromDb(issueId),
  ]);

  const fallbackChunks = [...chunks];
  const titleText = extras?.title || title;
  const summaryText = extras?.summary || issueSummary;
  if (fallbackChunks.length === 0 && (titleText || summaryText)) {
    fallbackChunks.push({
      documentId: 'sak',
      chunkIndex: 0,
      content: [titleText, summaryText].filter(Boolean).join('\n\n'),
    });
  }

  return synthesizeImpact({
    profile,
    chunks: fallbackChunks,
    summary,
    title: titleText,
  });
}
