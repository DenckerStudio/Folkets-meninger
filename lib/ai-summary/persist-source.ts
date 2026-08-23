import { getServiceSupabase } from '@/lib/supabase';
import type { StortingetSakDetail } from '@/lib/stortinget';
import {
  buildAiSummarySource,
  type AiSummaryChunkSource,
  type AiSummaryDocumentSource,
} from '@/lib/ai-summary/source-context';

export async function persistAiSummarySource(sakId: string): Promise<void> {
  const service = getServiceSupabase();
  const { data: issue } = await service
    .from('stortinget_issues')
    .select('title, summary, detail_json')
    .eq('id', sakId)
    .maybeSingle();

  if (!issue) return;

  const [{ data: documents }, { data: chunks }] = await Promise.all([
    service
      .from('stortinget_issue_documents')
      .select('document_id, title, document_type, text_excerpt, source_url')
      .eq('issue_id', sakId)
      .order('fetched_at', { ascending: false })
      .limit(6),
    service
      .from('document_chunks')
      .select('document_id, chunk_index, content')
      .eq('issue_id', sakId)
      .order('chunk_index', { ascending: true })
      .limit(16),
  ]);

  const source = buildAiSummarySource({
    issueId: sakId,
    title: issue.title,
    summary: issue.summary,
    detail: (issue.detail_json ?? null) as StortingetSakDetail | null,
    documents: (documents ?? []) as AiSummaryDocumentSource[],
    chunks: (chunks ?? []) as AiSummaryChunkSource[],
  });

  await service
    .from('stortinget_issues')
    .update({
      ai_summary_source_context: source.text,
      ai_summary_source_json: source.json,
      ai_summary_source_hash: source.hash,
      ai_summary_source_updated_at: new Date().toISOString(),
    })
    .eq('id', sakId);
}
