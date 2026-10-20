import { buildContentFeedbackSignedHeaders, CONTENT_FEEDBACK_OPS_PATH } from '@/lib/contentFeedbackHmac';

export type ContentFeedbackWebhookEvent = 'published' | 'deleted' | 'archived';

export type ContentFeedbackWebhookBody = {
  event: ContentFeedbackWebhookEvent;
  event_id: string;
  post_id: string;
  slug: string;
  title: string;
  excerpt: string;
  categories: string[];
  origin: string;
  occurred_at: string;
};

const WEBHOOK_TIMEOUT_MS = 3_000;

export function contentFeedbackSigningSecret(): string | null {
  return process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET?.trim() || null;
}

export function contentFeedbackWebhookUrl(): string | null {
  const webBase = process.env.FM_WEB_URL?.trim()?.replace(/\/+$/, '');
  if (!webBase) return null;
  const explicit = process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  return `${webBase}${CONTENT_FEEDBACK_OPS_PATH}`;
}

/** Fire-and-forget; never throws. Logs only HTTP status on failure. */
export function sendContentFeedbackWebhook(
  body: ContentFeedbackWebhookBody,
  log: {
    error: (obj: Record<string, unknown>) => void;
    warn?: (obj: Record<string, unknown>) => void;
  },
): void {
  const secret = contentFeedbackSigningSecret();
  const url = contentFeedbackWebhookUrl();
  if (!secret) {
    log.warn?.({ msg: 'content-feedback webhook skipped: signing secret not configured' });
    return;
  }
  if (!url) {
    log.warn?.({ msg: 'content-feedback webhook skipped: FM_WEB_URL not configured' });
    return;
  }

  const payload = JSON.stringify(body);
  const headers = buildContentFeedbackSignedHeaders(payload, secret);

  void fetch(url, {
    method: 'POST',
    headers,
    body: payload,
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  })
    .then((res) => {
      if (!res.ok) {
        log.error({
          msg: 'content-feedback webhook non-ok',
          status: res.status,
          event: body.event,
          post_id: body.post_id,
        });
      }
    })
    .catch((error) => {
      log.error({
        msg: 'content-feedback webhook failed',
        error,
        event: body.event,
        post_id: body.post_id,
      });
    });
}
