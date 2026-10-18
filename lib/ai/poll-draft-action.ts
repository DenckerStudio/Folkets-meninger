import { getServiceSupabase } from '@/lib/supabase';
import type { AiFeedbackReasonCode } from '@/lib/ai/reason-codes';

export async function adminPollDraftAction(input: {
  pollId: string;
  action: 'publish' | 'archive';
  title?: string;
  neutralSummary?: string;
  reasonCode?: AiFeedbackReasonCode | null;
  reasonNote?: string | null;
  decidedBy: string;
}): Promise<void> {
  const service = getServiceSupabase();
  const { error } = await service.rpc('admin_poll_draft_action', {
    p_poll_id: input.pollId,
    p_action: input.action,
    p_title: input.title ?? null,
    p_neutral_summary: input.neutralSummary ?? null,
    p_reason_code: input.reasonCode ?? null,
    p_reason_note: input.reasonNote ? input.reasonNote.slice(0, 300) : null,
    p_decided_by: input.decidedBy,
  });
  if (error) throw error;
}
