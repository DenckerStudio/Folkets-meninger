import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { isAgent } from '@/access/roles';
import { findPostBySlugOrSourceEvent } from '@/lib/postLookup';

export const dynamic = 'force-dynamic';

type LookupBody = {
  slug?: string;
  sourceEvent?: string;
};

export async function POST(request: Request) {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: request.headers });
  if (!user || !isAgent(user as { role?: string })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: LookupBody;
  try {
    body = (await request.json()) as LookupBody;
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const sourceEvent = typeof body.sourceEvent === 'string' ? body.sourceEvent.trim() : '';
  if (!slug && !sourceEvent) {
    return NextResponse.json({ error: 'slug eller sourceEvent er påkrevd' }, { status: 400 });
  }

  const hit = await findPostBySlugOrSourceEvent(payload, {
    slug: slug || undefined,
    sourceEvent: sourceEvent || undefined,
  });

  if (!hit) {
    return NextResponse.json({ found: false });
  }

  const serverUrl = process.env.SERVER_URL?.replace(/\/+$/, '') || '';
  return NextResponse.json({
    found: true,
    id: hit.id,
    slug: hit.slug,
    adminUrl: serverUrl ? `${serverUrl}/admin/collections/posts/${hit.id}` : hit.id,
  });
}
