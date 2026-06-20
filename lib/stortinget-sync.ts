import { getServiceSupabase } from '@/lib/supabase';
import { getSaker } from '@/lib/stortinget';
import { resolveSakListStatus } from '@/lib/sak-status';
import { getCachedSakDetail } from '@/lib/stortinget-detail-cache';

export type SyncIssuesResult = {
  upserted: number;
  total: number;
  newIssueIds: string[];
  aiSummaryTriggered: number;
};

export async function syncStortingetIssuesToDb(): Promise<SyncIssuesResult> {
  const issues = await getSaker();
  if (issues.length === 0) {
    return { upserted: 0, total: 0, newIssueIds: [], aiSummaryTriggered: 0 };
  }

  const service = getServiceSupabase();
  const now = new Date().toISOString();

  const rows = issues.map((issue) => ({
    id: String(issue.id),
    title: issue.title || `Sak ${issue.id}`,
    summary: issue.summary || issue.title || null,
    status: issue.status || 'pending',
    sak_kind: issue.sakKind,
    henvisning: issue.henvisning,
    dokumentgruppe: issue.dokumentgruppe,
    last_synced_at: now,
    last_updated_at: issue.date || now,
  }));

  const chunkSize = 100;
  let upserted = 0;
  const newIssueIds: string[] = [];
  const missingSummaryIds: string[] = [];

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { data: summaries } = await service
      .from('issue_ai_summaries')
      .select('stortinget_issue_id')
      .in('stortinget_issue_id', chunk.map((row) => row.id));
    const summarizedIds = new Set((summaries ?? []).map((row) => row.stortinget_issue_id));

    for (const row of chunk) {
      const { data: existing } = await service
        .from('stortinget_issues')
        .select('first_seen_at, status, detail_json')
        .eq('id', row.id)
        .maybeSingle();

      const detail = existing?.detail_json as { ferdigbehandlet?: boolean } | null;
      const status = resolveSakListStatus({
        ferdigbehandlet: detail?.ferdigbehandlet,
        cachedStatus: existing?.status ?? row.status,
      });

      const payload = {
        ...row,
        status,
        first_seen_at: existing?.first_seen_at ?? now,
      };

      const { error } = await service.from('stortinget_issues').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error('syncStortingetIssuesToDb row error:', error);
        throw error;
      }
      upserted += 1;
      if (!existing?.first_seen_at) {
        newIssueIds.push(row.id);
      }
      if (!summarizedIds.has(row.id)) {
        missingSummaryIds.push(row.id);
      }
    }
  }

  const candidates = [...new Set([...newIssueIds, ...missingSummaryIds.slice(0, 5)])];
  let aiSummaryTriggered = 0;

  for (const issueId of candidates) {
    await getCachedSakDetail(issueId);
    aiSummaryTriggered += 1;
  }

  return { upserted, total: issues.length, newIssueIds, aiSummaryTriggered };
}
