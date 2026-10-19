import type { Payload } from 'payload';

export type PostCmsStatus = 'draft' | 'published';

export type PostLookupHit = {
  id: string;
  slug: string;
  cmsStatus: PostCmsStatus;
};

function resolveCmsStatus(value: unknown): PostCmsStatus {
  return value === 'published' ? 'published' : 'draft';
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
      return {
        id: String(doc.id),
        slug: String(doc.slug),
        cmsStatus: resolveCmsStatus((doc as { _status?: string })._status),
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
      return {
        id: String(doc.id),
        slug: String(doc.slug),
        cmsStatus: resolveCmsStatus((doc as { _status?: string })._status),
      };
    }
  }

  return null;
}
