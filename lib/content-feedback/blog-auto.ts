import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';
import type { ContentFeedbackVerdict } from '@/lib/content-feedback/types';

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

function verdictForEvent(event: BlogContentFeedbackEvent): ContentFeedbackVerdict {
  switch (event) {
    case 'published':
      return 'approve';
    case 'deleted':
    case 'archived':
      return 'reject';
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

function snapshotForPayload(payload: BlogContentFeedbackPayload): Record<string, unknown> {
  return {
    auto_event: payload.event,
    slug: payload.slug,
    title: payload.title,
    excerpt: payload.excerpt,
    categories: payload.categories,
    origin: payload.origin,
    occurred_at: payload.occurred_at,
  };
}

function autoEventFromSnapshot(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object' || !('auto_event' in snapshot)) {
    return '';
  }
  return String((snapshot as { auto_event?: unknown }).auto_event ?? '');
}

export type RecordBlogAutoFeedbackResult =
  | { ok: true; id: string; duplicate: boolean; applied: boolean }
  | { ok: false; error: string };

export async function recordBlogAutoContentFeedbackWithClient(
  supabase: SupabaseClient,
  payload: BlogContentFeedbackPayload,
): Promise<RecordBlogAutoFeedbackResult> {
  const postId = payload.post_id.trim();
  if (!postId) {
    return { ok: false, error: 'post_id er påkrevd' };
  }

  const snapshot = snapshotForPayload(payload);
  const verdict = verdictForEvent(payload.event);

  const { data: existing, error: readError } = await supabase
    .from('content_feedback')
    .select('id, snapshot, source, verdict')
    .eq('content_type', 'blog_post')
    .eq('content_id', postId)
    .is('superseded_at', null)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: readError.message };
  }

  if (existing && existing.source !== 'auto') {
    return { ok: true, id: existing.id, duplicate: false, applied: false };
  }

  if (existing?.source === 'auto') {
    const existingEvent = autoEventFromSnapshot(existing.snapshot);
    if (existingEvent === payload.event) {
      return { ok: true, id: existing.id, duplicate: true, applied: false };
    }

    const { data: updated, error: updateError } = await supabase
      .from('content_feedback')
      .update({ verdict, snapshot })
      .eq('id', existing.id)
      .eq('source', 'auto')
      .select('id')
      .maybeSingle();

    if (updateError) {
      return { ok: false, error: updateError.message };
    }
    if (!updated?.id) {
      return { ok: false, error: 'Kunne ikke oppdatere auto content_feedback' };
    }

    return { ok: true, id: updated.id, duplicate: false, applied: true };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('content_feedback')
    .insert({
      content_type: 'blog_post',
      content_id: postId,
      verdict,
      aspects: {},
      reason_tags: [],
      note: null,
      snapshot,
      source: 'auto',
      admin_id: null,
    })
    .select('id')
    .single();

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return { ok: true, id: inserted.id, duplicate: false, applied: true };
}

export async function recordBlogAutoContentFeedback(
  payload: BlogContentFeedbackPayload,
): Promise<RecordBlogAutoFeedbackResult> {
  return recordBlogAutoContentFeedbackWithClient(getServiceSupabase(), payload);
}
