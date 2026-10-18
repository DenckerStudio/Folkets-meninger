import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { verifySignedRequest } from '@/lib/cms/hmac';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'REVALIDATE_SECRET is not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get('x-fm-timestamp');
  const signature = request.headers.get('x-fm-signature');

  if (!verifySignedRequest({ body: rawBody, secret, timestampHeader: timestamp, signatureHeader: signature })) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: { slug?: string; tags?: string[] } = {};
  try {
    payload = JSON.parse(rawBody) as { slug?: string; tags?: string[] };
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const tags = payload.tags?.length ? payload.tags : ['blog'];
  for (const tag of tags) {
    revalidateTag(tag);
  }
  if (payload.slug) {
    revalidateTag(`blog:${payload.slug}`);
  }

  return NextResponse.json({ ok: true, revalidated: tags });
}
