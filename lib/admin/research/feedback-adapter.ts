/**
 * content_feedback wiring lands after #192. Keep this interface for the follow-up PR.
 */
export const RESEARCH_CLUSTER_FEEDBACK_ENABLED = false;

export type ClusterFeedbackValue = 'like' | 'dislike';

export async function saveClusterFeedback(_input: {
  clusterId: string;
  userId: string;
  value: ClusterFeedbackValue;
}): Promise<{ ok: true }> {
  return { ok: true };
}
