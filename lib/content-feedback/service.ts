import { getServiceSupabase } from '@/lib/supabase';
import { buildAdminContentFeedbackSnapshot } from '@/lib/content-feedback/snapshot';
import { isPostgrestMissingRpcError } from '@/lib/polls/rpc-missing';
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

function feedbackRowId(data: unknown, rpcName: string): string {
  const id = typeof data === 'string' ? data : String(data ?? '');
  if (!id) {
    throw new Error(`Manglende id fra ${rpcName}`);
  }
  return id;
}

/**
 * Primary path is admin_submit_content_feedback (feedback + AI-summary regeneration).
 * Prod may not have applied 20261021140000 yet. PGRST202 then falls back to
 * upsert_content_feedback, which has the same arguments and is already granted
 * to service_role. Regeneration stays off until the admin RPC exists.
 */
export async function submitAdminContentFeedbackRpc(
  adminUserId: string,
  body: AdminContentFeedbackBody,
): Promise<{ id: string }> {
  const supabase = getServiceSupabase();
  const snapshot = await buildAdminContentFeedbackSnapshot(body.content_type, body.content_id);
  const args = {
    p_content_type: body.content_type,
    p_content_id: body.content_id,
    p_verdict: body.verdict,
    p_aspects: body.aspects,
    p_reason_tags: body.reason_tags,
    p_note: body.note,
    p_admin_id: adminUserId,
    p_snapshot: snapshot,
  };

  const primary = await supabase.rpc('admin_submit_content_feedback', args);
  if (!primary.error) {
    return { id: feedbackRowId(primary.data, 'admin_submit_content_feedback') };
  }

  if (!isPostgrestMissingRpcError(primary.error)) {
    throw primary.error;
  }

  console.warn(
    '[content-feedback] admin_submit_content_feedback mangler i PostgREST. Lagrer via upsert_content_feedback. Regenerering av AI-sammendrag starter når 20261021140000 er lagt inn.',
  );

  const fallback = await supabase.rpc('upsert_content_feedback', args);
  if (fallback.error) {
    throw fallback.error;
  }

  return { id: feedbackRowId(fallback.data, 'upsert_content_feedback') };
}
