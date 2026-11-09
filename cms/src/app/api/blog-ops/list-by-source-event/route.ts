import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { isAgent } from '@/access/roles';
import { findPostsBySourceEventPrefix } from '@/lib/postLookup';

export const dynamic = 'force-dynamic';

type ListBody = {
  sourceEventPrefix?: string;
};

export async function POST(request: Request) {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: request.headers });
  if (!user || !isAgent(user as { role?: string })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: ListBody;
  try {
    body = (await request.json()) as ListBody;
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const prefix =
    typeof body.sourceEventPrefix === 'string' ? body.sourceEventPrefix.trim() : '';
  if (!prefix || prefix.length > 200) {
    return NextResponse.json({ error: 'sourceEventPrefix er påkrevd' }, { status: 400 });
  }

  const hits = await findPostsBySourceEventPrefix(payload, prefix);
  const serverUrl = process.env.SERVER_URL?.replace(/\/+$/, '') || '';

  return NextResponse.json({
    drafts: hits.map((hit) => ({
      id: hit.id,
      slug: hit.slug,
      adminUrl: serverUrl ? `${serverUrl}/admin/collections/posts/${hit.id}` : hit.id,
      cmsStatus: hit.cmsStatus,
      sourceEvent: hit.sourceEvent ?? null,
      updatedAt: hit.updatedAt ?? null,
    })),
  });
}
