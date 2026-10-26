import {
  adminContentFeedbackBodySchema,
  validateRejectionDetail,
  type AdminContentFeedbackBody,
} from '@/lib/content-feedback/validation';
import { submitAdminContentFeedbackRpc } from '@/lib/content-feedback/service';

export type SubmitAdminContentFeedbackResult =
  | { ok: true; id: string; regeneration: boolean; regeneration_hint?: string }
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
    const result = await submitAdminContentFeedbackRpc(adminUserId, body);
    return {
      ok: true,
      id: result.id,
      regeneration: result.regeneration,
      regeneration_hint: result.regeneration_hint,
    };
  } catch (error) {
    console.error('content-feedback submit failed', error);
    return { ok: false, status: 500, error: 'Kunne ikke lagre tilbakemelding' };
  }
}
