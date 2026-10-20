import { createHmac, timingSafeEqual } from 'node:crypto';

export function signPayload(body: string, secret: string, timestamp: string): string {
  const payload = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifySignature(
  args: {
    body: string;
    secret: string;
    timestamp: string;
    signature: string;
    maxSkewMs?: number;
  },
): boolean {
  const maxSkewMs = args.maxSkewMs ?? 5 * 60 * 1000;
  const ts = Number(args.timestamp);
  if (!Number.isFinite(ts)) return false;
  const age = Math.abs(Date.now() - ts);
  if (age > maxSkewMs) return false;

  const expected = signPayload(args.body, args.secret, args.timestamp);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(args.signature.replace(/^sha256=/, ''), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function buildSignedHeaders(body: string, secret: string): Record<string, string> {
  const timestamp = String(Date.now());
  const signature = signPayload(body, secret, timestamp);
  return {
    'Content-Type': 'application/json',
    'x-fm-timestamp': timestamp,
    'x-fm-signature': `sha256=${signature}`,
  };
}
