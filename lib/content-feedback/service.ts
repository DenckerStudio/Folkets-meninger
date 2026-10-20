import { getServiceSupabase } from '@/lib/supabase';
import type { AdminContentFeedbackBody } from '@/lib/content-feedback/validation';
import type { UpsertContentFeedbackArgs } from '@/lib/content-feedback/types';

export async function upsertAdminContentFeedback(
  adminUserId: string,
  body: AdminContentFeedbackBody,
): Promise<{ id: string }> {
  const supabase = getServiceSupabase();
  const args: UpsertContentFeedbackArgs = {
    p_content_type: body.content_type,
    p_content_id: body.content_id,
    p_verdict: body.verdict,
    p_aspects: body.aspects,
    p_reason_tags: body.reason_tags,
    p_note: body.note,
    p_admin_id: adminUserId,
    p_snapshot: body.snapshot,
  };

  const { data, error } = await supabase.rpc('upsert_content_feedback', args);
  if (error) {
    throw error;
  }

  const id = typeof data === 'string' ? data : String(data ?? '');
  if (!id) {
    throw new Error('Manglende id fra upsert_content_feedback');
  }

  return { id };
}

export async function markAiSummaryRegenerationRequested(issueId: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('issue_ai_summaries')
    .update({ regeneration_requested_at: new Date().toISOString() })
    .eq('stortinget_issue_id', issueId);
  if (error) {
    throw error;
  }
}

export async function clearAiSummaryRegenerationRequest(issueId: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('issue_ai_summaries')
    .update({ regeneration_requested_at: null })
    .eq('stortinget_issue_id', issueId);
  if (error) {
    throw error;
  }
}
