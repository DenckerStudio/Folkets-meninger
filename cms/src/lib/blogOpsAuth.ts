import { verifySignature } from '@/lib/hmac';

export function blogOpsSigningSecret(): string | null {
  return (
    process.env.BLOG_OPS_SIGNING_SECRET?.trim() ||
    process.env.REVALIDATE_SECRET?.trim() ||
    null
  );
}

export async function verifyBlogOpsHmac(request: Request): Promise<{ ok: true; body: string } | { ok: false }> {
  const secret = blogOpsSigningSecret();
  if (!secret) return { ok: false };

  const body = await request.text();
  const timestamp = request.headers.get('x-fm-timestamp');
  const signature = request.headers.get('x-fm-signature');
  if (!timestamp || !signature) return { ok: false };

  const valid = verifySignature({
    body,
    secret,
    timestamp,
    signature,
  });
  if (!valid) return { ok: false };
  return { ok: true, body };
}
