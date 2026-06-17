import { getServiceSupabase } from './supabase';
import { getSakDetail, type StortingetSakDetail } from './stortinget';
import { mapSakPresentation } from './stortinget-sak-presentation';
import { triggerAiSummaryWebhook } from './trigger-ai-summary-webhook';
import { buildAiSummarySource, type AiSummaryDocumentSource } from './ai-summary/source-context';
import { ingestSakDocuments } from './stortinget-document-ingest';
import { resolveSakTreatmentStatus } from './sak-status';
import { getSakVotingWindow } from './sak-voting-window';
import { parseStortingetDotNetDateToISO } from './stortinget-utils';

const DETAIL_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type SakIssueMeta = {
  lastUpdatedAt: string | null;
  status: ReturnType<typeof resolveSakTreatmentStatus>;
  ferdigbehandlet: boolean | null;
  votingClosesAt: string | null;
};

function buildIssueUpsert(
  sakId: string,
  detail: StortingetSakDetail,
  presentation: ReturnType<typeof mapSakPresentation>,
  source: Awaited<ReturnType<typeof buildAiSummarySource>>,
  lastUpdatedAt?: string | null,
) {
  const treatmentStatus = resolveSakTreatmentStatus({
    ferdigbehandlet: detail.ferdigbehandlet,
    numericStatus: detail.status,
  });
  const votingWindow = getSakVotingWindow(detail, { ferdigbehandlet: detail.ferdigbehandlet });
  const sistOppdatert =
    parseStortingetDotNetDateToISO(detail.sist_oppdatert_dato ?? '') || lastUpdatedAt || null;

  return {
    id: sakId,
    title: presentation.title || detail.korttittel || detail.tittel || `Sak ${sakId}`,
    summary: presentation.summary || detail.tittel || null,
    status: treatmentStatus,
    ferdigbehandlet: typeof detail.ferdigbehandlet === 'boolean' ? detail.ferdigbehandlet : null,
    voting_closes_at: votingWindow.closesAt?.toISOString() ?? null,
    sak_kind: presentation.kind,
    henvisning: presentation.henvisning,
    dokumentgruppe: typeof detail.dokumentgruppe === 'number' ? detail.dokumentgruppe : null,
    detail_json: detail,
    last_synced_at: new Date().toISOString(),
    last_updated_at: sistOppdatert,
    ai_summary_source_context: source.text,
    ai_summary_source_json: source.json,
    ai_summary_source_hash: source.hash,
    ai_summary_source_updated_at: new Date().toISOString(),
  };
}

export async function getSakIssueMeta(sakId: string): Promise<SakIssueMeta | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  try {
    const service = getServiceSupabase();
    const { data } = await service
      .from('stortinget_issues')
      .select('status, ferdigbehandlet, voting_closes_at, last_updated_at')
      .eq('id', sakId)
      .maybeSingle();

    if (!data) return null;

    return {
      lastUpdatedAt: data.last_updated_at ?? null,
      status:
        data.status === 'closed' || data.status === 'pending'
          ? data.status
          : resolveSakTreatmentStatus({ ferdigbehandlet: data.ferdigbehandlet }),
      ferdigbehandlet: data.ferdigbehandlet ?? null,
      votingClosesAt: data.voting_closes_at ?? null,
    };
  } catch {
    return null;
  }
}

export async function refreshSakDetailCache(sakId: string): Promise<StortingetSakDetail | null> {
  return getCachedSakDetail(sakId, { forceRefresh: true });
}

export async function refreshSakStatusOnly(sakId: string): Promise<StortingetSakDetail | null> {
  return getCachedSakDetail(sakId, { forceRefresh: true, statusOnly: true });
}

export async function getCachedSakDetail(
  sakId: string,
  opts?: { forceRefresh?: boolean; statusOnly?: boolean },
): Promise<StortingetSakDetail | null> {
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
    .select('title, summary, detail_json, last_synced_at, last_updated_at, ai_summary_source_hash')
    .eq('id', sakId)
    .single();

  if (!opts?.forceRefresh && cached?.detail_json) {
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

  if (opts?.statusOnly) {
    await service.from('stortinget_issues').upsert(
      {
        id: sakId,
        title: presentation.title || detail.korttittel || detail.tittel || `Sak ${sakId}`,
        summary: presentation.summary || detail.tittel || null,
        status: resolveSakTreatmentStatus({
          ferdigbehandlet: detail.ferdigbehandlet,
          numericStatus: detail.status,
        }),
        ferdigbehandlet: typeof detail.ferdigbehandlet === 'boolean' ? detail.ferdigbehandlet : null,
        voting_closes_at:
          getSakVotingWindow(detail, { ferdigbehandlet: detail.ferdigbehandlet }).closesAt?.toISOString() ??
          null,
        sak_kind: presentation.kind,
        henvisning: presentation.henvisning,
        dokumentgruppe: typeof detail.dokumentgruppe === 'number' ? detail.dokumentgruppe : null,
        detail_json: detail,
        last_synced_at: new Date().toISOString(),
        last_updated_at:
          parseStortingetDotNetDateToISO(detail.sist_oppdatert_dato ?? '') ||
          cached?.last_updated_at ||
          null,
      },
      { onConflict: 'id' },
    );
    return detail;
  }

  const source = await updateAiSummarySource(service, sakId, detail, {
    title: presentation.title || `Sak ${sakId}`,
    summary: presentation.summary || null,
  });

  await service.from('stortinget_issues').upsert(
    buildIssueUpsert(sakId, detail, presentation, source, cached?.last_updated_at ?? null),
    { onConflict: 'id' },
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
  fallback: { title?: string | null; summary?: string | null },
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

export async function refreshStalePendingSakDetails(limit = 40): Promise<number> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return 0;
  }

  const service = getServiceSupabase();
  const staleBefore = new Date(Date.now() - DETAIL_CACHE_MAX_AGE_MS).toISOString();

  const { data: rows, error } = await service
    .from('stortinget_issues')
    .select('id')
    .eq('status', 'pending')
    .or(`last_synced_at.lt.${staleBefore},ferdigbehandlet.is.null,detail_json.is.null`)
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error || !rows?.length) {
    return 0;
  }

  let refreshed = 0;
  for (const row of rows) {
    const detail = await refreshSakDetailCache(String(row.id));
    if (detail) refreshed += 1;
  }

  return refreshed;
}
