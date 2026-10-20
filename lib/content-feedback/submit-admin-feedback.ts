import {
  adminContentFeedbackBodySchema,
  validateRejectionDetail,
  type AdminContentFeedbackBody,
} from '@/lib/content-feedback/validation';
import {
  clearAiSummaryRegenerationRequest,
  markAiSummaryRegenerationRequested,
  upsertAdminContentFeedback,
} from '@/lib/content-feedback/service';

export type SubmitAdminContentFeedbackResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string };

export function parseAdminContentFeedbackBody(
  raw: unknown,
): { ok: true; body: AdminContentFeedbackBody } | { ok: false; status: number; error: string } {
  const parsed = adminContentFeedbackBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'Ugyldig forespørsel' };
  }

  const detailError = validateRejectionDetail(
    parsed.data.verdict,
    parsed.data.aspects,
    parsed.data.reason_tags,
  );
  if (detailError) {
    return { ok: false, status: 400, error: detailError };
  }

  return { ok: true, body: parsed.data };
}

export async function submitAdminContentFeedback(
  adminUserId: string,
  body: AdminContentFeedbackBody,
): Promise<SubmitAdminContentFeedbackResult> {
  const detailError = validateRejectionDetail(body.verdict, body.aspects, body.reason_tags);
  if (detailError) {
    return { ok: false, status: 400, error: detailError };
  }

  try {
    const { id } = await upsertAdminContentFeedback(adminUserId, body);

    if (body.content_type === 'ai_summary') {
      if (body.verdict === 'reject') {
        await markAiSummaryRegenerationRequested(body.content_id);
      } else if (body.verdict === 'approve') {
        await clearAiSummaryRegenerationRequest(body.content_id);
      }
    }

    return { ok: true, id };
  } catch (error) {
    console.error('content-feedback upsert failed', error);
    return { ok: false, status: 500, error: 'Kunne ikke lagre tilbakemelding' };
  }
}
