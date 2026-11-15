import { DASHBOARD_PREFIX } from '@/lib/routes';
import { isResearchTopicDedicatedIssueId } from '@/lib/sak/research-topic-dedicated-issue';

/** Stortinget sak ids safe to expose in public poll/sak links (never `research-topic:`). */
export function pollPublicStortingetIssueId(issueId: string | null | undefined): string | null {
  const trimmed = issueId?.trim();
  if (!trimmed || isResearchTopicDedicatedIssueId(trimmed)) {
    return null;
  }
  return trimmed;
}

/** Dashboard sak URL for poll source links; null when issue is missing or dedicated. */
export function pollSakDashboardHref(issueId: string | null | undefined): string | null {
  const publicId = pollPublicStortingetIssueId(issueId);
  if (!publicId) return null;
  return `${DASHBOARD_PREFIX}/sak/${encodeURIComponent(publicId)}`;
}