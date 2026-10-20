import type { ContentFeedbackType } from '@/lib/content-feedback/types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORTINGET_ISSUE_ID_RE = /^\d{1,12}$/;
const PAYLOAD_ID_RE = /^\d+$/;

export function isValidContentId(contentType: ContentFeedbackType, contentId: string): boolean {
  switch (contentType) {
    case 'reel':
      return UUID_RE.test(contentId);
    case 'ai_summary':
      return STORTINGET_ISSUE_ID_RE.test(contentId);
    case 'blog_post':
      return PAYLOAD_ID_RE.test(contentId);
    case 'poll':
      return UUID_RE.test(contentId);
    case 'action':
      return UUID_RE.test(contentId);
    case 'source_item':
      return UUID_RE.test(contentId);
    default:
      return false;
  }
}
