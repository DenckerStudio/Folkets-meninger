import type { Payload } from 'payload';

export type PostCmsStatus = 'draft' | 'published' | 'unknown';

export type PostLookupHit = {
  id: string;
  slug: string;
  cmsStatus: PostCmsStatus;
  sourceEvent?: string;
  updatedAt?: string;
};

function resolveCmsStatus(value: unknown): PostCmsStatus {
  if (value === 'published') return 'published';
  if (value === 'draft') return 'draft';
  return 'unknown';
}

export async function findPostBySlugOrSourceEvent(
  payload: Payload,
  args: { slug?: string; sourceEvent?: string },
): Promise<PostLookupHit | null> {
  const slug = args.slug?.trim();
  const sourceEvent = args.sourceEvent?.trim();

  if (sourceEvent) {
    const byEvent = await payload.find({
      collection: 'posts',
      where: { sourceEvent: { equals: sourceEvent } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    });
    const doc = byEvent.docs[0];
    if (doc?.id) {
      const row = doc as { sourceEvent?: string; updatedAt?: string };
      return {
        id: String(doc.id),
        slug: String(doc.slug),
        cmsStatus: resolveCmsStatus((doc as { _status?: string })._status),
        sourceEvent: typeof row.sourceEvent === 'string' ? row.sourceEvent : undefined,
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
      };
    }
  }

  if (slug) {
    const bySlug = await payload.find({
      collection: 'posts',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    });
    const doc = bySlug.docs[0];
    if (doc?.id) {
      const row = doc as { sourceEvent?: string; updatedAt?: string };
      return {
        id: String(doc.id),
        slug: String(doc.slug),
        cmsStatus: resolveCmsStatus((doc as { _status?: string })._status),
        sourceEvent: typeof row.sourceEvent === 'string' ? row.sourceEvent : undefined,
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
      };
    }
  }

  return null;
}

export async function findPostsBySourceEventPrefix(
  payload: Payload,
  prefix: string,
  limit = 20,
): Promise<PostLookupHit[]> {
  const trimmed = prefix.trim();
  if (!trimmed) return [];

  const escaped = trimmed.replace(/[%_\\]/g, '\\$&');
  const result = await payload.find({
    collection: 'posts',
    where: { sourceEvent: { like: `${escaped}%` } },
    limit,
    sort: '-updatedAt',
    depth: 0,
    overrideAccess: true,
    pagination: false,
  });

  const hits: PostLookupHit[] = [];
  for (const doc of result.docs ?? []) {
    if (!doc?.id) continue;
    const row = doc as { sourceEvent?: string; updatedAt?: string; slug?: string; _status?: string };
    hits.push({
      id: String(doc.id),
      slug: String(row.slug ?? ''),
      cmsStatus: resolveCmsStatus(row._status),
      sourceEvent: typeof row.sourceEvent === 'string' ? row.sourceEvent : undefined,
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
    });
  }
  return hits;
}
