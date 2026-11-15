import { routes, DASHBOARD_PREFIX } from '@/lib/routes';
import {
  isResearchTopicDedicatedIssueId,
  parseResearchTopicIdFromDedicatedSakId,
} from '@/lib/sak/research-topic-dedicated-issue';

export type PollSourceSakLink = {
  href: string;
  label: string;
  kind: 'stortinget' | 'dedicated' | 'research-topic';
};

/** Lenke til temasak på dashboard (kolon URL-encodes). */
export function dedicatedResearchTopicSakHref(issueId: string): string {
  return `${DASHBOARD_PREFIX}/sak/${encodeURIComponent(issueId.trim())}`;
}

/**
 * Én fungerende sak-lenke for avstemning:
 * ekte Stortinget-sak → dashboard/sak; temasak → dedikert saksid; ellers /dette-snakkes-det-om.
 */
export function resolvePollSourceSakLink(
  stortingetIssueId: string | null | undefined,
  options?: { researchTopicId?: string | null },
): PollSourceSakLink | null {
  const trimmed = stortingetIssueId?.trim() || null;
  const topicFromRow = options?.researchTopicId?.trim() || null;
  const topicFromDedicated = trimmed ? parseResearchTopicIdFromDedicatedSakId(trimmed) : null;
  const topicId = topicFromRow || topicFromDedicated;

  if (trimmed && !isResearchTopicDedicatedIssueId(trimmed)) {
    return {
      href: `${DASHBOARD_PREFIX}/sak/${encodeURIComponent(trimmed)}`,
      label: `Stortingssak ${trimmed}`,
      kind: 'stortinget',
    };
  }

  if (trimmed && isResearchTopicDedicatedIssueId(trimmed)) {
    return {
      href: dedicatedResearchTopicSakHref(trimmed),
      label: 'Les temasaken',
      kind: 'dedicated',
    };
  }

  if (topicId) {
    return {
      href: routes.detteSnakkesDetOmTopic(topicId),
      label: 'Dette snakkes det om',
      kind: 'research-topic',
    };
  }

  return null;
}

/** @deprecated Bruk resolvePollSourceSakLink */
export function pollPublicStortingetIssueId(issueId: string | null | undefined): string | null {
  const trimmed = issueId?.trim();
  if (!trimmed || isResearchTopicDedicatedIssueId(trimmed)) {
    return null;
  }
  return trimmed;
}

/** @deprecated Bruk resolvePollSourceSakLink */
export function pollSakDashboardHref(issueId: string | null | undefined): string | null {
  return resolvePollSourceSakLink(issueId)?.href ?? null;
}