import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';
import type {
  LogBlogContentFeedbackResult,
  LogBlogContentFeedbackStatus,
} from '@/lib/content-feedback/types';

export type BlogContentFeedbackEvent = 'published' | 'deleted' | 'archived';

export type BlogContentFeedbackPayload = {
  event: BlogContentFeedbackEvent;
  event_id: string;
  post_id: string;
  slug: string;
  title: string;
  excerpt: string;
  categories: string[];
  origin: string;
  occurred_at: string;
};

export type RecordBlogAutoFeedbackResult =
  | { ok: true; rpc: LogBlogContentFeedbackResult }
  | { ok: false; error: string };

function snapshotForRpc(payload: BlogContentFeedbackPayload): Record<string, unknown> {
  return {
    slug: payload.slug,
    title: payload.title,
    excerpt: payload.excerpt,
    categories: payload.categories,
    origin: payload.origin,
  };
}

function mapRpcStatus(status: string): LogBlogContentFeedbackStatus | null {
  switch (status) {
    case 'inserted':
    case 'updated':
    case 'duplicate':
    case 'stale':
    case 'skipped_admin':
      return status;
    default:
      return null;
  }
}

function parseLogBlogContentFeedbackResult(data: unknown): LogBlogContentFeedbackResult | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as { status?: unknown; id?: unknown };
  const status = mapRpcStatus(String(row.status ?? ''));
  const id = String(row.id ?? '').trim();
  if (!status || !id) return null;
  return { status, id };
}

export async function recordBlogAutoContentFeedbackWithClient(
  supabase: SupabaseClient,
  payload: BlogContentFeedbackPayload,
): Promise<RecordBlogAutoFeedbackResult> {
  const postId = payload.post_id.trim();
  const eventId = payload.event_id.trim();
  if (!postId) {
    return { ok: false, error: 'post_id er påkrevd' };
  }
  if (!eventId) {
    return { ok: false, error: 'event_id er påkrevd' };
  }

  const occurredAt = payload.occurred_at.trim() || new Date().toISOString();

  const { data, error } = await supabase.rpc('log_blog_content_feedback', {
    p_post_id: postId,
    p_event: payload.event,
    p_event_id: eventId,
    p_occurred_at: occurredAt,
    p_snapshot: snapshotForRpc(payload),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rpc = parseLogBlogContentFeedbackResult(data);
  if (!rpc) {
    return { ok: false, error: 'Ugyldig svar fra log_blog_content_feedback' };
  }

  return { ok: true, rpc };
}

export async function recordBlogAutoContentFeedback(
  payload: BlogContentFeedbackPayload,
): Promise<RecordBlogAutoFeedbackResult> {
  return recordBlogAutoContentFeedbackWithClient(getServiceSupabase(), payload);
}
