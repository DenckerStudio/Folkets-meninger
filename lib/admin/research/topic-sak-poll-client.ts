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

/** Legacy placeholder — must not be published. */
export const RESEARCH_TOPIC_SAK_POLL_INGRESS_PLACEHOLDER =
  'Nøytral oppsummering av temaet, basert på brief-funnene.';

export function validateResearchTopicSakPollIngress(summary: string): string | null {
  const trimmed = summary.trim();
  if (!trimmed) {
    return 'Nøytral ingress er påkrevd.';
  }
  if (trimmed === RESEARCH_TOPIC_SAK_POLL_INGRESS_PLACEHOLDER) {
    return 'Skriv en egen nøytral ingress.';
  }
  return null;
}

/** CamelCase payload for validateStortingetPollAdminForm (not for POST JSON). */
export function buildResearchTopicSakPollFormValidationInput(input: {
  suggestedIssueId: string;
  title: string;
  neutralSummary: string;
  closesAtDate: string;
  closesAtTime: string;
}): Record<string, unknown> {
  return {
    issueId: input.suggestedIssueId.trim(),
    title: input.title.trim(),
    neutralSummary: input.neutralSummary.trim(),
    isUpdate: false,
    closesAtDate: input.closesAtDate,
    closesAtTime: input.closesAtTime,
  };
}
