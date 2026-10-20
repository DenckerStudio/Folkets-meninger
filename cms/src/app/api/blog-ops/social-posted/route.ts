import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { verifyBlogOpsHmac } from '@/lib/blogOpsAuth';
import { isValidBlogSlug, normalizeBlogSlug } from '@/lib/blogSlug';

export const dynamic = 'force-dynamic';

type SocialBody = {
  slug?: string;
  blueskyUri?: string | null;
};

export async function POST(request: Request) {
  const verified = await verifyBlogOpsHmac(request);
  if (!verified.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SocialBody;
  try {
    body = JSON.parse(verified.body) as SocialBody;
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const slug = normalizeBlogSlug(typeof body.slug === 'string' ? body.slug : '');
  if (!isValidBlogSlug(slug)) {
    return NextResponse.json({ error: 'Ugyldig slug' }, { status: 400 });
  }

  const blueskyUri =
    typeof body.blueskyUri === 'string' && body.blueskyUri.trim()
      ? body.blueskyUri.trim()
      : null;

  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: 'posts',
    where: {
      and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    pagination: false,
  });

  const doc = found.docs[0];
  if (!doc?.id) {
    return NextResponse.json({ error: 'Fant ikke publisert innlegg' }, { status: 404 });
  }

  const existingSocial =
    doc.social && typeof doc.social === 'object'
      ? (doc.social as Record<string, unknown>)
      : {};

  await payload.update({
    collection: 'posts',
    id: doc.id,
    depth: 0,
    overrideAccess: true,
    data: {
      social: {
        ...existingSocial,
        socialPostedAt: new Date().toISOString(),
        blueskyUri: blueskyUri ?? (existingSocial.blueskyUri as string | null | undefined) ?? null,
      },
    },
  });

  return NextResponse.json({ ok: true, slug, id: String(doc.id) });
}
