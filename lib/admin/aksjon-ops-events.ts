import { getServiceSupabase } from '@/lib/supabase';

export type AksjonOpsEvent = {
  id: string;
  subject: string;
  createdAt: string;
  clusterKey: string | null;
  pollId: string | null;
  text: string | null;
};

export async function listRecentAksjonOpsEvents(limit = 20): Promise<AksjonOpsEvent[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await service
    .from('n8n_ops_events')
    .select('id, subject, created_at, payload')
    .eq('kind', 'info')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[admin] listRecentAksjonOpsEvents failed', error);
    return [];
  }

  return (data ?? [])
    .map((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      const meta = (payload.meta ?? payload) as Record<string, unknown>;
      if (meta.domain !== 'aksjoner' && payload.domain !== 'aksjoner') return null;
      return {
        id: row.id as string,
        subject: row.subject as string,
        createdAt: row.created_at as string,
        clusterKey:
          typeof meta.cluster_key === 'string'
            ? meta.cluster_key
            : typeof payload.cluster_key === 'string'
              ? payload.cluster_key
              : null,
        pollId:
          typeof meta.poll_id === 'string'
            ? meta.poll_id
            : typeof payload.poll_id === 'string'
              ? payload.poll_id
              : null,
        text: typeof payload.text === 'string' ? payload.text : null,
      } satisfies AksjonOpsEvent;
    })
    .filter((x): x is AksjonOpsEvent => x != null);
}
