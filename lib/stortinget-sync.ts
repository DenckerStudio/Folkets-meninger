import { getServiceSupabase } from '@/lib/supabase';
import { getSaker } from '@/lib/stortinget';

export type SyncIssuesResult = {
  upserted: number;
  total: number;
};

export async function syncStortingetIssuesToDb(): Promise<SyncIssuesResult> {
  const issues = await getSaker();
  if (issues.length === 0) {
    return { upserted: 0, total: 0 };
  }

  const service = getServiceSupabase();
  const now = new Date().toISOString();

  const rows = issues.map((issue) => ({
    id: String(issue.id),
    title: issue.title || `Sak ${issue.id}`,
    summary: issue.summary || issue.title || null,
    status: issue.status || 'pending',
    last_synced_at: now,
    last_updated_at: issue.date || now,
  }));

  const chunkSize = 100;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    for (const row of chunk) {
      const { data: existing } = await service
        .from('stortinget_issues')
        .select('first_seen_at')
        .eq('id', row.id)
        .maybeSingle();

      const payload = {
        ...row,
        first_seen_at: existing?.first_seen_at ?? now,
      };

      const { error } = await service.from('stortinget_issues').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error('syncStortingetIssuesToDb row error:', error);
        throw error;
      }
      upserted += 1;
    }
  }

  return { upserted, total: issues.length };
}
