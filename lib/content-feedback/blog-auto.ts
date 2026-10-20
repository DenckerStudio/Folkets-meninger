import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';

export type BlogContentFeedbackEvent = 'published' | 'deleted' | 'archived';

export type BlogContentFeedbackPayload = {
  event: BlogContentFeedbackEvent;
  post_id: string;
  slug: string;
  title: string;
  excerpt: string;
  categories: string[];
  origin: string;
  occurred_at: string;
};

export type BlogAutoFeedbackStatus =
  | 'inserted'
  | 'updated'
  | 'duplicate'
  | 'stale'
  | 'skipped_admin';

export type RecordBlogAutoFeedbackResult =
  | {
      ok: true;
      id: string;
      status: BlogAutoFeedbackStatus;
      duplicate: boolean;
      applied: boolean;
    }
  | { ok: false; error: string };

function eventIdForPayload(payload: BlogContentFeedbackPayload): string {
  return `${payload.post_id.trim()}:${payload.event}`;
}

function snapshotForRpc(payload: BlogContentFeedbackPayload): Record<string, unknown> {
  return {
    slug: payload.slug,
    title: payload.title,
    excerpt: payload.excerpt,
    categories: payload.categories,
    origin: payload.origin,
  };
}

function mapRpcStatus(status: string): BlogAutoFeedbackStatus {
  switch (status) {
    case 'inserted':
    case 'updated':
    case 'duplicate':
    case 'stale':
    case 'skipped_admin':
      return status;
    default:
      return 'inserted';
  }
}

export async function recordBlogAutoContentFeedbackWithClient(
  supabase: SupabaseClient,
  payload: BlogContentFeedbackPayload,
): Promise<RecordBlogAutoFeedbackResult> {
  const postId = payload.post_id.trim();
  if (!postId) {
    return { ok: false, error: 'post_id er påkrevd' };
  }

  const occurredAt = payload.occurred_at.trim() || new Date().toISOString();

  const { data, error } = await supabase.rpc('log_blog_content_feedback', {
    p_post_id: postId,
    p_event: payload.event,
    p_event_id: eventIdForPayload(payload),
    p_occurred_at: occurredAt,
    p_snapshot: snapshotForRpc(payload),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as { status?: string; id?: string } | null;
  const status = mapRpcStatus(String(row?.status ?? ''));
  const id = String(row?.id ?? '');
  if (!id) {
    return { ok: false, error: 'log_blog_content_feedback returnerte ikke id' };
  }

  const duplicate = status === 'duplicate';
  const applied = status === 'inserted' || status === 'updated';

  return { ok: true, id, status, duplicate, applied };
}

export async function recordBlogAutoContentFeedback(
  payload: BlogContentFeedbackPayload,
): Promise<RecordBlogAutoFeedbackResult> {
  return recordBlogAutoContentFeedbackWithClient(getServiceSupabase(), payload);
}
