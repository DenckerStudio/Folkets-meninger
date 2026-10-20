/**
 * TODO(content_feedback): Bytt til `content_feedback` med content_type='action'
 * når migrasjon 20261021120000 er på plass. Ikke opprett egen feedback-tabell her.
 */
export type ClusterFeedbackValue = 'like' | 'dislike';

export async function saveClusterFeedback(_input: {
  clusterId: string;
  userId: string;
  value: ClusterFeedbackValue;
}): Promise<{ ok: true }> {
  return { ok: true };
}
