import { getServiceSupabase } from './supabase';
import { getSakDetail, type StortingetSakDetail } from './stortinget';
import { mapSakPresentation } from './stortinget-sak-presentation';
import { triggerAiSummaryWebhook } from './trigger-ai-summary-webhook';
import { buildAiSummarySource, type AiSummaryDocumentSource } from './ai-summary/source-context';
import { ingestSakDocuments } from './stortinget-document-ingest';

const DETAIL_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export async function getCachedSakDetail(sakId: string): Promise<StortingetSakDetail | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return getSakDetail(sakId, { nextRevalidateSeconds: 3600 });
  }

  let service;
  try {
    service = getServiceSupabase();
  } catch {
    return getSakDetail(sakId, { nextRevalidateSeconds: 3600 });
  }

  const { data: cached } = await service
    .from('stortinget_issues')
    .select('title, summary, detail_json, last_synced_at, ai_summary_source_hash')
    .eq('id', sakId)
    .single();

  if (cached?.detail_json) {
    const age = Date.now() - new Date(cached.last_synced_at).getTime();
    if (age < DETAIL_CACHE_MAX_AGE_MS) {
      const detail = cached.detail_json as StortingetSakDetail;
      if (!cached.ai_summary_source_hash) {
        const source = await updateAiSummarySource(service, sakId, detail, {
          title: cached.title,
          summary: cached.summary,
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
      void ingestSakDocuments(sakId, detail).catch((error) => {
        console.warn('[document-ingest] Failed during cache hit:', error);
      });
      return detail;
    }
  }

  const detail = await getSakDetail(sakId, { nextRevalidateSeconds: 3600 });
  if (!detail) return (cached?.detail_json as StortingetSakDetail | undefined) ?? null;

  const presentation = mapSakPresentation({
    korttittel: detail.korttittel,
    tittel: detail.tittel,
    henvisning: detail.henvisning,
    dokumentgruppe: typeof detail.dokumentgruppe === 'number' ? detail.dokumentgruppe : null,
    emneNavn: detail.emne_liste?.[0]?.navn,
  });

  const source = await updateAiSummarySource(service, sakId, detail, {
    title: presentation.title || `Sak ${sakId}`,
    summary: presentation.summary || null,
  });

  await service.from('stortinget_issues').upsert(
    {
      id: sakId,
      title: presentation.title || detail.korttittel || detail.tittel || `Sak ${sakId}`,
      summary: presentation.summary || detail.tittel || null,
      status: detail.ferdigbehandlet ? 'closed' : 'pending',
      sak_kind: presentation.kind,
      henvisning: presentation.henvisning,
      dokumentgruppe: typeof detail.dokumentgruppe === 'number' ? detail.dokumentgruppe : null,
      detail_json: detail,
      last_synced_at: new Date().toISOString(),
      ai_summary_source_context: source.text,
      ai_summary_source_json: source.json,
      ai_summary_source_hash: source.hash,
      ai_summary_source_updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  const { data: existingSummary } = await service
    .from('issue_ai_summaries')
    .select('stortinget_issue_id')
    .eq('stortinget_issue_id', sakId)
    .maybeSingle();

  if (!existingSummary) {
    triggerAiSummaryWebhook(sakId);
  }

  void ingestSakDocuments(sakId, detail).catch((error) => {
    console.warn('[document-ingest] Failed during cache refresh:', error);
  });

  return detail;
}

async function updateAiSummarySource(
  service: ReturnType<typeof getServiceSupabase>,
  sakId: string,
  detail: StortingetSakDetail,
  fallback: { title?: string | null; summary?: string | null }
) {
  const { data: documents } = await service
    .from('stortinget_issue_documents')
    .select('document_id, title, document_type, text_excerpt, source_url, content_full_text')
    .eq('issue_id', sakId)
    .order('fetched_at', { ascending: false })
    .limit(5);

  return buildAiSummarySource({
    issueId: sakId,
    title: fallback.title,
    summary: fallback.summary,
    detail,
    documents: (documents ?? []) as AiSummaryDocumentSource[],
  });
}
