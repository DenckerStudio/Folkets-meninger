import { verifySignedRequest } from '@/lib/cms/hmac';

/** CMS → fm-web content-feedback webhook (falls back to REVALIDATE_SECRET like blog-ops). */
export function contentFeedbackWebhookSecret(): string | null {
  return (
    process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET?.trim() ||
    process.env.REVALIDATE_SECRET?.trim() ||
    null
  );
}

export function verifyContentFeedbackWebhook(request: Request, rawBody: string): boolean {
  const secret = contentFeedbackWebhookSecret();
  if (!secret) return false;

  return verifySignedRequest({
    body: rawBody,
    secret,
    timestampHeader: request.headers.get('x-fm-timestamp'),
    signatureHeader: request.headers.get('x-fm-signature'),
  });
}
