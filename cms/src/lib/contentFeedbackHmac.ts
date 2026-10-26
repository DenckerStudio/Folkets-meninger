import { createHmac, timingSafeEqual } from 'node:crypto';

export const CONTENT_FEEDBACK_OPS_PATH = '/api/ops/content-feedback';

function signingPayload(timestamp: string, method: string, path: string, body: string): string {
  return `${timestamp}.${method.toUpperCase()}.${path}.${body}`;
}

export function buildContentFeedbackSignedHeaders(
  body: string,
  secret: string,
  method = 'POST',
  path = CONTENT_FEEDBACK_OPS_PATH,
): Record<string, string> {
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', secret)
    .update(signingPayload(timestamp, method, path, body))
    .digest('hex');
  return {
    'Content-Type': 'application/json',
    'x-fm-timestamp': timestamp,
    'x-fm-signature': `sha256=${signature}`,
  };
}

export function verifyContentFeedbackSignedRequest(args: {
  body: string;
  secret: string;
  method: string;
  path: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  maxSkewMs?: number;
}): boolean {
  const secret = args.secret.trim();
  if (!secret || !args.timestampHeader || !args.signatureHeader) return false;

  const maxSkewMs = args.maxSkewMs ?? 5 * 60 * 1000;
  const ts = Number(args.timestampHeader);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > maxSkewMs) return false;

  const expected = createHmac('sha256', secret)
    .update(signingPayload(args.timestampHeader, args.method, args.path, args.body))
    .digest('hex');
  const provided = args.signatureHeader.replace(/^sha256=/, '');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
