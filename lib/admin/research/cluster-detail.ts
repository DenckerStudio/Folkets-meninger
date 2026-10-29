import { mapClusterToRow } from '@/lib/admin/oppfanget/service';
import type { OppfangetRow } from '@/lib/admin/oppfanget/types';
import {
  expireStaleResearchBriefs,
  listResearchBriefsForCluster,
} from '@/lib/admin/research/service';
import type { ResearchBriefRow } from '@/lib/admin/research/types';
import { getServiceSupabase } from '@/lib/supabase';

export type ResearchClusterDetail = {
  row: OppfangetRow;
  briefs: ResearchBriefRow[];
};

export async function loadResearchClusterDetail(
  clusterId: string,
): Promise<ResearchClusterDetail | null> {
  const supabase = getServiceSupabase();
  const { data: cluster, error } = await supabase
    .from('action_clusters')
    .select(
      'id, action_name, action_type, status, sensitive_category, max_confidence, best_scale, first_seen_at, last_seen_at, poll_id, metadata',
    )
    .eq('id', clusterId)
    .maybeSingle();
  if (error || !cluster) return null;

  await expireStaleResearchBriefs();

  const { data: sources } = await supabase
    .from('action_sources')
    .select('id, cluster_id, url_canonical, publisher, signal_only, title, source_type')
    .eq('cluster_id', clusterId);

  let pollStatus: string | null = null;
  if (cluster.poll_id) {
    const { data: poll } = await supabase
      .from('polls')
      .select('status')
      .eq('id', cluster.poll_id)
      .maybeSingle();
    pollStatus = poll?.status ?? null;
  }

  const row = mapClusterToRow(
    {
      id: cluster.id,
      action_name: cluster.action_name,
      action_type: cluster.action_type,
      status: cluster.status,
      sensitive_category: cluster.sensitive_category,
      max_confidence: cluster.max_confidence,
      best_scale: cluster.best_scale as Record<string, unknown> | null,
      first_seen_at: cluster.first_seen_at,
      last_seen_at: cluster.last_seen_at,
      poll_id: cluster.poll_id,
      metadata: cluster.metadata as Record<string, unknown> | null,
    },
    sources ?? [],
    pollStatus,
  );

  const briefs = await listResearchBriefsForCluster(clusterId);
  return { row, briefs };
}
