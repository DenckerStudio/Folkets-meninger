import { getServiceSupabase } from '@/lib/supabase';
import { listBlogDraftsForReview } from '@/lib/admin/blog-review';
import type { ContentFeedbackType } from '@/lib/content-feedback/types';

const ALLOWED_SNAPSHOT_KEYS = new Set([
  'title',
  'neutral_summary',
  'issue_id',
  'excerpt',
  'slug',
  'review_state',
  'narrative',
  'hva',
]);

const FORBIDDEN_SNAPSHOT_KEYS = new Set([
  'event_id',
  'occurred_at',
  'source',
  'event',
  'admin_id',
]);

export const SNAPSHOT_MAX_BYTES = 8 * 1024;

export function sanitizeSnapshotInput(raw: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!raw) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (FORBIDDEN_SNAPSHOT_KEYS.has(key)) continue;
    if (!ALLOWED_SNAPSHOT_KEYS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export function assertSnapshotSize(snapshot: Record<string, unknown>): void {
  const bytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
  if (bytes > SNAPSHOT_MAX_BYTES) {
    throw new Error('Snapshot er for stort');
  }
}

export async function buildAdminContentFeedbackSnapshot(
  contentType: ContentFeedbackType,
  contentId: string,
): Promise<Record<string, unknown>> {
  const supabase = getServiceSupabase();
  let snapshot: Record<string, unknown> = {};

  switch (contentType) {
    case 'reel': {
      const { data: poll } = await supabase
        .from('polls')
        .select('id, title, neutral_summary, stortinget_issue_id')
        .eq('id', contentId)
        .maybeSingle();
      if (poll) {
        snapshot = {
          title: poll.title,
          neutral_summary: poll.neutral_summary,
          issue_id: poll.stortinget_issue_id,
        };
      }
      break;
    }
    case 'ai_summary': {
      const [{ data: issue }, { data: summary }] = await Promise.all([
        supabase.from('stortinget_issues').select('id, title').eq('id', contentId).maybeSingle(),
        supabase
          .from('issue_ai_summaries')
          .select('narrative, hva')
          .eq('stortinget_issue_id', contentId)
          .maybeSingle(),
      ]);
      snapshot = {
        issue_id: contentId,
        title: issue?.title ?? null,
        narrative: summary?.narrative ?? summary?.hva ?? null,
      };
      break;
    }
    case 'blog_post': {
      const drafts = await listBlogDraftsForReview(100);
      const draft = drafts.find((row) => row.id === contentId);
      if (draft) {
        snapshot = {
          title: draft.title,
          excerpt: draft.excerpt,
          slug: draft.slug,
          review_state: draft.reviewState,
        };
      }
      break;
    }
    default:
      break;
  }

  const cleaned = sanitizeSnapshotInput(snapshot);
  assertSnapshotSize(cleaned);
  return cleaned;
}
