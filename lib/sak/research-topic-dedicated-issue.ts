export const RESEARCH_TOPIC_SAK_ID_PREFIX = 'research-topic:';

export function researchTopicDedicatedIssueId(topicId: string): string {
  return `${RESEARCH_TOPIC_SAK_ID_PREFIX}${topicId.trim()}`;
}

export function isResearchTopicDedicatedIssueId(issueId: string): boolean {
  return issueId.trim().startsWith(RESEARCH_TOPIC_SAK_ID_PREFIX);
}

export function parseResearchTopicIdFromDedicatedSakId(sakId: string): string | null {
  const trimmed = sakId.trim();
  if (!isResearchTopicDedicatedIssueId(trimmed)) return null;
  const topicId = trimmed.slice(RESEARCH_TOPIC_SAK_ID_PREFIX.length).trim();
  return topicId || null;
}

/** Decode App Router `[id]` param (kolon i research-topic:-ider). */
export function normalizeDashboardSakRouteId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.includes('%')) return trimmed;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}
