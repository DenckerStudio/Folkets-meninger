import { adminBlogPostUrl } from '@/lib/blog/urls';
import type { BlogDraftEditSaved } from '@/lib/admin/blog-draft-edit';
import { payloadPatchPost } from '@/lib/cms/payload-update';
import { payloadFetchList } from '@/lib/cms/payload-client';
import type { PayloadPost } from '@/lib/cms/types';

export type BlogDraftReviewItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  reviewState: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  expiredAt: string | null;
  restoredAt: string | null;
  payloadAdminUrl: string | null;
};

/** Query flags for admin review lists — always read Payload draft versions. */
export const BLOG_DRAFT_REVIEW_LIST_QUERY = {
  depth: 0,
  draft: true,
} as const;

function mapBlogDraftReviewItem(post: PayloadPost): BlogDraftReviewItem {
  return {
    id: String(post.id),
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    bodyMarkdown: post.bodyMarkdown ?? '',
    reviewState: post.review?.state ? String(post.review.state) : null,
    createdAt: post.createdAt ?? null,
    updatedAt: post.updatedAt ?? null,
    expiredAt: post.expiredAt ?? null,
    restoredAt: post.restoredAt ?? null,
    payloadAdminUrl: adminBlogPostUrl(String(post.id)),
  };
}

const PENDING_BLOG_DRAFT_QUERY = {
  'where[_status][equals]': 'draft',
  'where[review.state][in]': 'til_vurdering,ny',
  'where[expiredAt][exists]': 'false',
} as const;

export async function listBlogDraftsForReview(limit = 30): Promise<BlogDraftReviewItem[]> {
  const data = await payloadFetchList<PayloadPost>(
    'posts',
    {
      ...BLOG_DRAFT_REVIEW_LIST_QUERY,
      limit,
      sort: '-updatedAt',
      ...PENDING_BLOG_DRAFT_QUERY,
    },
    { revalidate: 0, tags: ['blog-admin-review'] },
  );

  if (!data?.docs?.length) return [];

  return data.docs.map(mapBlogDraftReviewItem);
}

export async function listExpiredBlogDraftsForReview(limit = 30): Promise<BlogDraftReviewItem[]> {
  const data = await payloadFetchList<PayloadPost>(
    'posts',
    {
      ...BLOG_DRAFT_REVIEW_LIST_QUERY,
      limit,
      sort: '-expiredAt',
      'where[_status][equals]': 'draft',
      'where[review.state][in]': 'til_vurdering,ny',
      'where[expiredAt][exists]': 'true',
    },
    { revalidate: 0, tags: ['blog-admin-review-expired'] },
  );

  if (!data?.docs?.length) return [];

  return data.docs.map(mapBlogDraftReviewItem);
}

export function mergeBlogDraftReviewItemAfterEdit(
  drafts: BlogDraftReviewItem[],
  saved: BlogDraftEditSaved,
): BlogDraftReviewItem[] {
  return drafts.map((row) =>
    row.id === saved.id
      ? {
          ...row,
          title: saved.title,
          excerpt: saved.excerpt,
          bodyMarkdown: saved.bodyMarkdown,
          updatedAt: saved.updatedAt ?? row.updatedAt,
        }
      : row,
  );
}

export function blogDraftReviewItemForReopen(
  drafts: BlogDraftReviewItem[],
  draftId: string,
): BlogDraftReviewItem | null {
  return drafts.find((row) => row.id === draftId) ?? null;
}

export async function restoreExpiredBlogDraft(postId: string): Promise<void> {
  const result = await payloadPatchPost(postId, {
    expiredAt: null,
    restoredAt: new Date().toISOString(),
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
}
