import { getServiceSupabase } from '@/lib/supabase';
import { getAiSummaryFromDb } from '@/lib/ai-summary/service';
import { synthesizeImpact } from './synthesize';
import type { ImpactChunk, ImpactProfile, ImpactResult } from './types';

const MAX_CHUNKS = 80;
const MAX_CHUNK_CHARS = 1600;

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function loadIssueImpactChunks(issueId: string): Promise<ImpactChunk[]> {
  if (!supabaseConfigured()) return [];

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('document_chunks')
      .select('document_id, chunk_index, content')
      .eq('issue_id', issueId)
      .order('chunk_index', { ascending: true })
      .limit(MAX_CHUNKS);

    if (error || !data) return [];

    return data
      .map((row) => ({
        documentId: String(row.document_id ?? ''),
        chunkIndex: Number(row.chunk_index ?? 0),
        content: String(row.content ?? '').slice(0, MAX_CHUNK_CHARS),
      }))
      .filter((row) => row.content.trim().length > 0);
  } catch (error) {
    console.error('[impact] Kunne ikke hente dokumentutdrag:', error);
    return [];
  }
}

export async function calculateSakImpact(
  issueId: string,
  profile: ImpactProfile,
): Promise<ImpactResult> {
  const [chunks, summary] = await Promise.all([
    loadIssueImpactChunks(issueId),
    getAiSummaryFromDb(issueId),
  ]);

  return synthesizeImpact({
    profile,
    chunks,
    summary,
  });
}
