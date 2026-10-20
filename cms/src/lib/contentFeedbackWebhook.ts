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

export const CONTENT_FEEDBACK_WEBHOOK_TIMEOUT_MS = 10_000;

export type ContentFeedbackWebhookFailureKind = 'config' | 'client' | 'retryable';

export class ContentFeedbackWebhookError extends Error {
  readonly kind: ContentFeedbackWebhookFailureKind;
  readonly httpStatus?: number;

  constructor(
    message: string,
    kind: ContentFeedbackWebhookFailureKind,
    httpStatus?: number,
  ) {
    super(message);
    this.name = 'ContentFeedbackWebhookError';
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

export function contentFeedbackSigningSecret(): string | null {
  return (
    process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET?.trim() ||
    process.env.REVALIDATE_SECRET?.trim() ||
    null
  );
}

export function contentFeedbackWebhookUrl(): string | null {
  const webBase = process.env.FM_WEB_URL?.trim()?.replace(/\/+$/, '');
  if (!webBase) return null;
  const explicit = process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  return `${webBase}${CONTENT_FEEDBACK_OPS_PATH}`;
}

type WebhookLogger = {
  error: (obj: Record<string, unknown>) => void;
};

/**
 * POST signed content-feedback payload. Throws on misconfiguration, retryable HTTP/network errors,
 * or non-retryable 4xx (after logging status).
 */
export async function sendContentFeedbackWebhook(
  body: ContentFeedbackWebhookBody,
  log?: WebhookLogger,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const secret = contentFeedbackSigningSecret();
  if (!secret) {
    throw new ContentFeedbackWebhookError(
      'content-feedback webhook: signing secret not configured',
      'config',
    );
  }

  const url = contentFeedbackWebhookUrl();
  if (!url) {
    throw new ContentFeedbackWebhookError(
      'content-feedback webhook: FM_WEB_URL not configured',
      'config',
    );
  }

  const payload = JSON.stringify(body);
  const headers = buildContentFeedbackSignedHeaders(payload, secret);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(CONTENT_FEEDBACK_WEBHOOK_TIMEOUT_MS),
    });
  } catch {
    throw new ContentFeedbackWebhookError(
      'content-feedback webhook: network or timeout error',
      'retryable',
    );
  }

  if (response.ok) {
    return;
  }

  const status = response.status;
  if (status === 429 || status >= 500) {
    throw new ContentFeedbackWebhookError(
      `content-feedback webhook: HTTP ${status}`,
      'retryable',
      status,
    );
  }

  log?.error({
    msg: 'content-feedback webhook non-retryable client error',
    status,
    event: body.event,
    post_id: body.post_id,
  });

  throw new ContentFeedbackWebhookError(
    `content-feedback webhook: HTTP ${status}`,
    'client',
    status,
  );
}
