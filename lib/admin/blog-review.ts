import { adminBlogPostUrl } from '@/lib/blog/urls';
import { payloadFetchList } from '@/lib/cms/payload-client';
import type { PayloadPost } from '@/lib/cms/types';

export type BlogDraftReviewItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  reviewState: string | null;
  updatedAt: string | null;
  payloadAdminUrl: string | null;
};

export async function listBlogDraftsForReview(limit = 30): Promise<BlogDraftReviewItem[]> {
  const data = await payloadFetchList<PayloadPost>(
    'posts',
    {
      depth: 0,
      limit,
      sort: '-updatedAt',
      'where[_status][equals]': 'draft',
      'where[review.state][in]': 'til_vurdering,ny',
    },
    { revalidate: 0, tags: ['blog-admin-review'] },
  );

  if (!data?.docs?.length) return [];

  return data.docs.map((post) => ({
    id: String(post.id),
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    reviewState: post.review?.state ? String(post.review.state) : null,
    updatedAt: post.updatedAt ?? null,
    payloadAdminUrl: adminBlogPostUrl(String(post.id)),
  }));
}
