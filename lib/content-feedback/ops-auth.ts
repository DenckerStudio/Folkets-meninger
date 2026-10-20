import {
  CONTENT_FEEDBACK_OPS_PATH,
  verifyContentFeedbackRequest,
} from '@/lib/content-feedback/ops-hmac';

/** CMS → fm-web content-feedback webhook (dedicated secret only). */
export function contentFeedbackWebhookSecret(): string | null {
  return process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET?.trim() || null;
}

export function verifyContentFeedbackWebhook(request: Request, rawBody: string): boolean {
  const secret = contentFeedbackWebhookSecret();
  if (!secret) return false;

  const url = new URL(request.url);
  if (url.pathname !== CONTENT_FEEDBACK_OPS_PATH) {
    return false;
  }

  return verifyContentFeedbackRequest({
    secret,
    method: request.method,
    path: CONTENT_FEEDBACK_OPS_PATH,
    body: rawBody,
    timestampHeader: request.headers.get('x-fm-timestamp'),
    signatureHeader: request.headers.get('x-fm-signature'),
  });
}
