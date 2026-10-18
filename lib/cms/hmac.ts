import { createHmac, timingSafeEqual } from 'node:crypto';

export function signPayload(body: string, secret: string, timestamp: string): string {
  const payload = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifySignedRequest(args: {
  body: string;
  secret: string;
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

  const expected = signPayload(args.body, secret, args.timestampHeader);
  const provided = args.signatureHeader.replace(/^sha256=/, '');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
