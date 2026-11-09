export const RESEARCH_TOPIC_SAK_ID_PREFIX = 'research-topic:';

export function researchTopicDedicatedIssueId(topicId: string): string {
  return `${RESEARCH_TOPIC_SAK_ID_PREFIX}${topicId.trim()}`;
}

export function isResearchTopicDedicatedIssueId(issueId: string): boolean {
  return issueId.trim().startsWith(RESEARCH_TOPIC_SAK_ID_PREFIX);
}
