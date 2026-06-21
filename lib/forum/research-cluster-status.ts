/** forum_research_clusters.status — DB-backed pipeline queue */
export const RESEARCH_CLUSTER_STATUSES = [
  'pending',
  'accepted',
  'processing',
  'draft',
  'finished',
  'rejected',
  'failed',
] as const;

export type ResearchClusterStatus = (typeof RESEARCH_CLUSTER_STATUSES)[number];

export function isResearchClusterStatus(value: string): value is ResearchClusterStatus {
  return (RESEARCH_CLUSTER_STATUSES as readonly string[]).includes(value);
}

/** Scout output awaiting admin review */
export const CLUSTER_SCOUT_QUEUE_STATUSES: ResearchClusterStatus[] = ['pending'];

/** v12 pipeline queue (Regjeringen RSS → AI prompt generator) */
export const CLUSTER_PIPELINE_QUEUE_STATUSES: ResearchClusterStatus[] = ['pending'];
