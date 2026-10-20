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
  'truncated',
]);

const FORBIDDEN_SNAPSHOT_KEYS = new Set([
  'event_id',
  'occurred_at',
  'source',
  'event',
  'admin_id',
]);

const SNAPSHOT_TEXT_KEYS = [
  'title',
  'neutral_summary',
  'excerpt',
  'narrative',
  'hva',
] as const;

export const SNAPSHOT_MAX_BYTES = 8 * 1024;

/** Shortens on grapheme boundaries so emoji and combining marks are not split. */
export function truncateToGraphemes(text: string, maxGraphemes: number): string {
  if (maxGraphemes <= 0) return '';
  if (text.length <= maxGraphemes) {
    return text;
  }

  const Segmenter = (
    globalThis as { Intl?: { Segmenter?: new (locale: string, options: { granularity: 'grapheme' }) => {
      segment: (input: string) => Iterable<{ segment: string }>;
    } } }
  ).Intl?.Segmenter;

  if (Segmenter) {
    const segmenter = new Segmenter('nb', { granularity: 'grapheme' });
    let count = 0;
    let out = '';
    for (const part of segmenter.segment(text)) {
      if (count >= maxGraphemes) break;
      out += part.segment;
      count += 1;
    }
    return out;
  }

  let i = 0;
  let graphemes = 0;
  while (i < text.length && graphemes < maxGraphemes) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i += 2;
        graphemes += 1;
        continue;
      }
    }
    i += 1;
    graphemes += 1;
  }
  return text.slice(0, i);
}

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

export function snapshotByteLength(snapshot: Record<string, unknown>): number {
  return Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
}

/** Truncates long text fields until JSON fits; sets truncated: true when shortened. */
export function fitSnapshotToMaxBytes(
  snapshot: Record<string, unknown>,
  maxBytes: number = SNAPSHOT_MAX_BYTES,
): Record<string, unknown> {
  let out: Record<string, unknown> = { ...snapshot };
  if (snapshotByteLength(out) <= maxBytes) {
    return out;
  }

  let maxChars = 4000;
  while (maxChars > 32) {
    out = { ...snapshot };
    let truncated = false;
    for (const key of SNAPSHOT_TEXT_KEYS) {
      const value = out[key];
      if (typeof value === 'string' && value.length > maxChars) {
        out[key] = `${truncateToGraphemes(value, maxChars)}…`;
        truncated = true;
      }
    }
    if (truncated) {
      out.truncated = true;
    }
    if (snapshotByteLength(out) <= maxBytes) {
      return out;
    }
    maxChars = Math.floor(maxChars * 0.65);
  }

  const minimal: Record<string, unknown> = { truncated: true };
  if (typeof snapshot.issue_id === 'string') {
    minimal.issue_id = snapshot.issue_id;
  }
  if (typeof snapshot.title === 'string') {
    minimal.title = truncateToGraphemes(snapshot.title, 120);
  }
  return minimal;
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
  return fitSnapshotToMaxBytes(cleaned);
}
