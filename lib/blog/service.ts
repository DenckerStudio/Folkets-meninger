import { mapPayloadCategories, mapPayloadPostToListItem, mapPayloadPostToPublic } from '@/lib/cms/map-post';
import {
  getCmsAgentKey,
  getCmsBaseUrl,
  isCmsConfigured,
  payloadFetch,
  payloadFetchList,
} from '@/lib/cms/payload-client';
import type { PayloadCategory, PayloadPost } from '@/lib/cms/types';
import { isValidBlogSlug, normalizeBlogSlug } from '@/lib/blog/slug';
import type { BlogCategory, BlogPostListItem, BlogPostPublic } from '@/lib/blog/types';
import { BLOG_PAGE_SIZE } from '@/lib/blog/types';
import { adminBlogPostUrl } from '@/lib/blog/urls';
import { cmsBlogOpsLookup, cmsBlogOpsSocialPosted } from '@/lib/cms/blog-ops-client';
import { normalizeBlogExcerpt, normalizeBlueskyText } from '@/lib/blog/text-limits';

const POST_DEPTH = 2;

function publishedQuery(extra?: Record<string, string | number>) {
  return {
    depth: POST_DEPTH,
    sort: '-publishedAt',
    'where[_status][equals]': 'published',
    ...(extra ?? {}),
  };
}

export async function listPublishedBlogPosts(limit = 50): Promise<BlogPostPublic[]> {
  if (!isCmsConfigured()) return [];
  const data = await payloadFetchList<PayloadPost>('posts', {
    ...publishedQuery(),
    limit,
  });
  if (!data?.docs?.length) return [];
  return data.docs.map(mapPayloadPostToPublic);
}

export async function listPublishedBlogPostsPaginated(args: {
  page: number;
  categorySlug?: string | null;
  pageSize?: number;
}): Promise<{
  posts: BlogPostListItem[];
  totalPages: number;
  totalDocs: number;
  page: number;
}> {
  const pageSize = args.pageSize ?? BLOG_PAGE_SIZE;
  const page = Math.max(1, args.page);
  if (!isCmsConfigured()) {
    return { posts: [], totalPages: 0, totalDocs: 0, page };
  }

  const query: Record<string, string | number> = {
    ...publishedQuery(),
    limit: pageSize,
    page,
  };

  if (args.categorySlug) {
    const categories = await payloadFetchList<PayloadCategory>('categories', {
      limit: 1,
      'where[slug][equals]': args.categorySlug,
    });
    const categoryId = categories?.docs?.[0]?.id;
    if (!categoryId) {
      return { posts: [], totalPages: 0, totalDocs: 0, page };
    }
    query['where[category][equals]'] = categoryId;
  }

  const data = await payloadFetchList<PayloadPost>('posts', query);
  if (!data) return { posts: [], totalPages: 0, totalDocs: 0, page };

  return {
    posts: data.docs.map(mapPayloadPostToListItem),
    totalPages: data.totalPages,
    totalDocs: data.totalDocs,
    page: data.page,
  };
}

export async function getFeaturedBlogPost(): Promise<BlogPostPublic | null> {
  if (!isCmsConfigured()) return null;
  const data = await payloadFetchList<PayloadPost>('posts', {
    ...publishedQuery(),
    limit: 1,
    'where[featured][equals]': 'true',
  });
  const post = data?.docs?.[0];
  return post ? mapPayloadPostToPublic(post) : null;
}

export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPostPublic | null> {
  if (!isCmsConfigured()) return null;
  const data = await payloadFetchList<PayloadPost>('posts', {
    ...publishedQuery(),
    limit: 1,
    'where[slug][equals]': slug,
  });
  const post = data?.docs?.[0];
  return post ? mapPayloadPostToPublic(post) : null;
}

export async function listBlogCategories(): Promise<BlogCategory[]> {
  if (!isCmsConfigured()) return [];
  const data = await payloadFetchList<PayloadCategory>('categories', {
    limit: 20,
    sort: 'order',
  });
  if (!data?.docs?.length) return [];
  return mapPayloadCategories(data.docs);
}

export async function listPublishedBlogSlugsForSitemap(limit = 200): Promise<
  { slug: string; published_at: string | null; updated_at: string | null }[]
> {
  if (!isCmsConfigured()) return [];
  const data = await payloadFetchList<PayloadPost>('posts', {
    ...publishedQuery(),
    limit,
    depth: 0,
  });
  if (!data?.docs?.length) return [];
  return data.docs.map((post) => ({
    slug: post.slug,
    published_at: post.publishedAt ?? null,
    updated_at: post.updatedAtDisplay ?? post.updatedAt ?? post.publishedAt ?? null,
  }));
}

async function findCategoryId(slug: string): Promise<string | null> {
  const categories = await payloadFetchList<PayloadCategory>('categories', {
    limit: 1,
    'where[slug][equals]': slug,
  });
  return categories?.docs?.[0]?.id ?? null;
}

export type CreateBlogDraftInput = {
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  tags?: string[];
  suggested_tags?: string[];
  category?: string;
  related_sak_ids?: string[];
  related_horing_ids?: string[];
  source_event?: string | null;
  bluesky_text?: string;
  ai?: { model_family?: string; prompt_version?: string; generated_at?: string };
};

export type CreateBlogDraftResult =
  | { ok: true; id: string; slug: string; created: boolean; adminUrl: string }
  | { ok: false; status: number; error: string };

export async function createBlogDraft(input: CreateBlogDraftInput): Promise<CreateBlogDraftResult> {
  const agentKey = getCmsAgentKey();
  const base = getCmsBaseUrl();
  if (!base || !agentKey) {
    return { ok: false, status: 503, error: 'CMS er ikke konfigurert' };
  }

  const slug = normalizeBlogSlug(input.slug);
  if (!isValidBlogSlug(slug)) {
    return { ok: false, status: 400, error: 'Ugyldig slug' };
  }

  const sourceEvent = input.source_event?.trim() || null;
  const existing = await cmsBlogOpsLookup({
    slug,
    sourceEvent: sourceEvent ?? undefined,
  });
  if (existing === null) {
    return { ok: false, status: 503, error: 'CMS-oppslag feilet' };
  }
  if (existing.found) {
    return {
      ok: true,
      id: existing.id,
      slug: existing.slug,
      created: false,
      adminUrl: existing.adminUrl,
    };
  }

  const categorySlug = normalizeBlogSlug(input.category || 'forklart');
  const categoryId = await findCategoryId(categorySlug);
  if (!categoryId) {
    return { ok: false, status: 400, error: 'Ukjent kategori' };
  }

  const suggested = (input.suggested_tags ?? input.tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);

  const excerpt = normalizeBlogExcerpt(input.excerpt);
  const blueskyText = normalizeBlueskyText(excerpt, input.bluesky_text);

  const body = {
    slug,
    title: input.title.trim(),
    excerpt,
    bodyMarkdown: input.body_md,
    category: categoryId,
    relatedSakIds: (input.related_sak_ids ?? []).map((id) => ({ id: id.trim() })).filter((row) => row.id),
    relatedHoringIds: (input.related_horing_ids ?? [])
      .map((id) => ({ id: id.trim() }))
      .filter((row) => row.id),
    suggestedTags: suggested.map((value) => ({ value })),
    sourceEvent,
    origin: 'n8n',
    _status: 'draft',
    ai: {
      assisted: true,
      modelFamily: input.ai?.model_family ?? 'gemma4',
      promptVersion: input.ai?.prompt_version ?? null,
      generatedAt: input.ai?.generated_at ?? new Date().toISOString(),
    },
    social: {
      blueskyText,
    },
    review: { state: 'til_vurdering' },
  };

  const created = await payloadFetch<PayloadPost>('/api/posts?draft=true', {
    method: 'POST',
    apiKey: agentKey,
    body,
    tags: ['blog'],
    revalidate: 0,
  });

  if (!created?.id) {
    return { ok: false, status: 500, error: 'Kunne ikke opprette utkast i CMS' };
  }

  return {
    ok: true,
    id: String(created.id),
    slug: created.slug,
    created: true,
    adminUrl: `${base}/admin/collections/posts/${created.id}`,
  };
}

export async function markBlogSocialPosted(
  slug: string,
  blueskyUri?: string | null,
): Promise<boolean> {
  if (!getCmsBaseUrl() || !process.env.REVALIDATE_SECRET?.trim()) return false;
  return cmsBlogOpsSocialPosted(slug, blueskyUri);
}

export function cmsAdminUrlForPost(id: string): string {
  const base = getCmsBaseUrl();
  if (base) return `${base}/admin/collections/posts/${id}`;
  return adminBlogPostUrl(id);
}
