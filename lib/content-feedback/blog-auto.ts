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

export type RecordBlogAutoFeedbackResult =
  | { ok: true; id: string; duplicate: boolean }
  | { ok: false; error: string };

export async function recordBlogAutoContentFeedbackWithClient(
  supabase: SupabaseClient,
  payload: BlogContentFeedbackPayload,
): Promise<RecordBlogAutoFeedbackResult> {
  const postId = payload.post_id.trim();
  if (!postId) {
    return { ok: false, error: 'post_id er påkrevd' };
  }

  const { data: existing, error: readError } = await supabase
    .from('content_feedback')
    .select('id, snapshot')
    .eq('content_type', 'blog_post')
    .eq('content_id', postId)
    .is('superseded_at', null)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: readError.message };
  }

  const existingEvent =
    existing?.snapshot &&
    typeof existing.snapshot === 'object' &&
    'auto_event' in existing.snapshot
      ? String((existing.snapshot as { auto_event?: unknown }).auto_event ?? '')
      : '';

  if (existing && existingEvent === payload.event) {
    return { ok: true, id: existing.id, duplicate: true };
  }

  if (existing?.id) {
    const { error: supersedeError } = await supabase
      .from('content_feedback')
      .update({ superseded_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (supersedeError) {
      return { ok: false, error: supersedeError.message };
    }
  }

  const snapshot = {
    auto_event: payload.event,
    slug: payload.slug,
    title: payload.title,
    excerpt: payload.excerpt,
    categories: payload.categories,
    origin: payload.origin,
    occurred_at: payload.occurred_at,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('content_feedback')
    .insert({
      content_type: 'blog_post',
      content_id: postId,
      verdict: verdictForEvent(payload.event),
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

  return { ok: true, id: inserted.id, duplicate: false };
}

export async function recordBlogAutoContentFeedback(
  payload: BlogContentFeedbackPayload,
): Promise<RecordBlogAutoFeedbackResult> {
  return recordBlogAutoContentFeedbackWithClient(getServiceSupabase(), payload);
}
