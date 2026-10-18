import { getServiceSupabase } from '@/lib/supabase';
import type { AiFeedbackReasonCode } from '@/lib/ai/reason-codes';

export async function recordSummaryRegenerateFeedback(input: {
  issueId: string;
  reasonCode: AiFeedbackReasonCode;
  reasonNote?: string | null;
  decidedBy: string;
  beforeJson: Record<string, unknown>;
}): Promise<void> {
  const service = getServiceSupabase();
  const { error } = await service.rpc('record_ai_feedback', {
    p_target_type: 'issue_summary',
    p_target_id: input.issueId,
    p_source: 'regenerate',
    p_decision: 'regenerated',
    p_reason_code: input.reasonCode,
    p_reason_note: input.reasonNote ? input.reasonNote.slice(0, 300) : null,
    p_before_json: input.beforeJson,
    p_after_json: null,
    p_before_text:
      typeof input.beforeJson.narrative === 'string'
        ? input.beforeJson.narrative
        : typeof input.beforeJson.hva === 'string'
          ? input.beforeJson.hva
          : null,
    p_after_text: null,
    p_decided_by: input.decidedBy,
    p_generation_id: null,
  });
  if (error) throw error;
}
