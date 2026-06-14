import { getServiceSupabase } from './supabase';
import { getSakDetail, type StortingetSakDetail } from './stortinget';
import { triggerAiSummaryWebhook } from './trigger-ai-summary-webhook';

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
    .select('detail_json, last_synced_at')
    .eq('id', sakId)
    .single();

  if (cached?.detail_json) {
    const age = Date.now() - new Date(cached.last_synced_at).getTime();
    if (age < DETAIL_CACHE_MAX_AGE_MS) {
      return cached.detail_json as StortingetSakDetail;
    }
  }

  const detail = await getSakDetail(sakId, { nextRevalidateSeconds: 3600 });
  if (!detail) return (cached?.detail_json as StortingetSakDetail | undefined) ?? null;

  await service.from('stortinget_issues').upsert(
    {
      id: sakId,
      title: detail.korttittel || detail.tittel || `Sak ${sakId}`,
      summary: detail.tittel || null,
      status: detail.ferdigbehandlet ? 'closed' : 'pending',
      detail_json: detail,
      last_synced_at: new Date().toISOString(),
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

  return detail;
}
