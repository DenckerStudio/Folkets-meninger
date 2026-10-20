import { getServiceSupabase } from '@/lib/supabase';
import { buildAdminContentFeedbackSnapshot } from '@/lib/content-feedback/snapshot';
import type { AdminContentFeedbackBody } from '@/lib/content-feedback/validation';
import type {
  ContentFeedbackAspects,
  ContentFeedbackType,
  ContentFeedbackVerdict,
} from '@/lib/content-feedback/types';

export type AdminContentFeedbackRecord = {
  id: string;
  verdict: ContentFeedbackVerdict;
  aspects: ContentFeedbackAspects;
  reason_tags: string[];
  note: string | null;
  created_at: string;
  source: string;
};

export async function getAdminContentFeedback(
  contentType: ContentFeedbackType,
  contentId: string,
): Promise<AdminContentFeedbackRecord | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('content_feedback')
    .select('id, verdict, aspects, reason_tags, note, created_at, source')
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .is('superseded_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return {
    id: data.id,
    verdict: data.verdict as ContentFeedbackVerdict,
    aspects: (data.aspects ?? {}) as ContentFeedbackAspects,
    reason_tags: Array.isArray(data.reason_tags) ? data.reason_tags : [],
    note: data.note,
    created_at: data.created_at,
    source: data.source,
  };
}

export async function submitAdminContentFeedbackRpc(
  adminUserId: string,
  body: AdminContentFeedbackBody,
): Promise<{ id: string }> {
  const supabase = getServiceSupabase();
  const snapshot = await buildAdminContentFeedbackSnapshot(body.content_type, body.content_id);

  const { data, error } = await supabase.rpc('admin_submit_content_feedback', {
    p_content_type: body.content_type,
    p_content_id: body.content_id,
    p_verdict: body.verdict,
    p_aspects: body.aspects,
    p_reason_tags: body.reason_tags,
    p_note: body.note,
    p_admin_id: adminUserId,
    p_snapshot: snapshot,
  });

  if (error) {
    throw error;
  }

  const id = typeof data === 'string' ? data : String(data ?? '');
  if (!id) {
    throw new Error('Manglende id fra admin_submit_content_feedback');
  }

  return { id };
}
