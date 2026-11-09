import { RESEARCH_TOPIC_UNPUBLISHABLE_NOTICE } from '@/lib/admin/research/topic-brief-schema';
import type { ResearchTopicRow } from '@/lib/admin/research/topic-types';

export function researchTopicSakPollBlockingMessage(
  topic: Pick<ResearchTopicRow, 'blocking_reason'>,
): string {
  const reason = topic.blocking_reason?.trim();
  return reason || RESEARCH_TOPIC_UNPUBLISHABLE_NOTICE;
}

export function researchTopicSakPollCanCreate(
  topic: Pick<ResearchTopicRow, 'status' | 'publishable'>,
): boolean {
  return topic.status === 'done' && topic.publishable === true;
}
