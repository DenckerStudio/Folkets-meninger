import {
  mapPayloadCategories,
  mapPayloadPostToListItem,
  mapPayloadPostToPublic,
  resolvePayloadPublishedAt,
  sortPayloadPostsByDisplayDate,
} from '@/lib/cms/map-post';
import { payloadCreatePost } from '@/lib/cms/payload-create';
import { CmsFetchError } from '@/lib/cms/cms-fetch-error';
import {
  getCmsAgentKey,
  getCmsBaseUrl,
  isCmsConfigured,
  payloadFetchList,
} from '@/lib/cms/payload-client';
import type { PayloadCategory, PayloadPost } from '@/lib/cms/types';
import { isValidBlogSlug, normalizeBlogSlug } from '@/lib/blog/slug';
import type { BlogCategory, BlogPostListItem, BlogPostPublic } from '@/lib/blog/types';
import { BLOG_PAGE_SIZE } from '@/lib/blog/types';
import { adminBlogPostUrl } from '@/lib/blog/urls';
import {
  cmsBlogOpsLookup,
  cmsBlogOpsSocialPosted,
  type BlogPostCmsStatus,
} from '@/lib/cms/blog-ops-client';
import {
  normalizeBlogExcerpt,
  normalizeBlogTitle,
  normalizeBlueskyText,
} from '@/lib/blog/text-limits';

const POST_DEPTH = 2;
const BLOG_READ_CACHE = { allowIsrCache: true, revalidate: 3600 } as const;

function emptyPaginated(page: number) {
  return { posts: [], totalPages: 0, totalDocs: 0, page };
}

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
  const data = await payloadFetchList<PayloadPost>(
    'posts',
    {
      ...publishedQuery(),
      limit,
    },
    BLOG_READ_CACHE,
  );
  if (!data.docs.length) return [];
  return sortPayloadPostsByDisplayDate(data.docs).map(mapPayloadPostToPublic);
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
  if (!isCmsConfigured()) return emptyPaginated(page);

  const query: Record<string, string | number> = {
    ...publishedQuery(),
    limit: pageSize,
    page,
  };

  if (args.categorySlug) {
    const categories = await payloadFetchList<PayloadCategory>(
      'categories',
      {
        limit: 1,
        'where[slug][equals]': args.categorySlug,
      },
      BLOG_READ_CACHE,
    );
    const categoryId = categories?.docs?.[0]?.id;
    if (!categoryId) {
      return { posts: [], totalPages: 0, totalDocs: 0, page };
    }
    query['where[category][equals]'] = categoryId;
  }

  const data = await payloadFetchList<PayloadPost>('posts', query, BLOG_READ_CACHE);

  return {
    posts: sortPayloadPostsByDisplayDate(data.docs).map(mapPayloadPostToListItem),
    totalPages: data.totalPages,
    totalDocs: data.totalDocs,
    page: data.page,
  };
}

export async function getFeaturedBlogPost(): Promise<BlogPostPublic | null> {
  if (!isCmsConfigured()) return null;
  const data = await payloadFetchList<PayloadPost>(
    'posts',
    {
      ...publishedQuery(),
      limit: 1,
      'where[featured][equals]': 'true',
    },
    BLOG_READ_CACHE,
  );
  const post = data?.docs?.[0];
  return post ? mapPayloadPostToPublic(post) : null;
}

export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPostPublic | null> {
  if (!isCmsConfigured()) return null;
  const data = await payloadFetchList<PayloadPost>(
    'posts',
    {
      ...publishedQuery(),
      limit: 1,
      'where[slug][equals]': slug,
    },
    BLOG_READ_CACHE,
  );
  const post = data?.docs?.[0];
  return post ? mapPayloadPostToPublic(post) : null;
}

export async function listBlogCategories(): Promise<BlogCategory[]> {
  if (!isCmsConfigured()) return [];
  const data = await payloadFetchList<PayloadCategory>(
    'categories',
    {
      limit: 20,
      sort: 'order',
    },
    BLOG_READ_CACHE,
  );
  if (!data.docs.length) return [];
  return mapPayloadCategories(data.docs);
}

export async function listPublishedBlogSlugsForSitemap(limit = 200): Promise<
  { slug: string; published_at: string | null; updated_at: string | null }[]
> {
  if (!isCmsConfigured()) return [];
  const data = await payloadFetchList<PayloadPost>(
    'posts',
    {
      ...publishedQuery(),
      limit,
      depth: 0,
    },
    BLOG_READ_CACHE,
  );
  if (!data.docs.length) return [];
  return data.docs.map((post) => ({
    slug: post.slug,
    published_at: resolvePayloadPublishedAt(post),
    updated_at: post.updatedAtDisplay ?? post.updatedAt ?? resolvePayloadPublishedAt(post) ?? null,
  }));
}

async function findCategoryId(slug: string): Promise<string | null> {
  const categories = await payloadFetchList<PayloadCategory>(
    'categories',
    {
      limit: 1,
      'where[slug][equals]': slug,
    },
    BLOG_READ_CACHE,
  );
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
  review_note?: string;
  bluesky_text?: string;
  ai?: { model_family?: string; prompt_version?: string; generated_at?: string };
};

export type CreateBlogDraftResult =
  | {
      ok: true;
      id: string;
      slug: string;
      created: boolean;
      adminUrl: string;
      cmsStatus: BlogPostCmsStatus;
    }
  | {
      ok: false;
      status: number;
      error: string;
      id?: string;
      slug?: string;
      adminUrl?: string;
      cmsStatus?: BlogPostCmsStatus;
    };

export async function createBlogDraft(input: CreateBlogDraftInput): Promise<CreateBlogDraftResult> {
  const base = getCmsBaseUrl();
  const agentKey = getCmsAgentKey();
  if (!base) {
    return { ok: false, status: 503, error: 'CMS_URL mangler på app-serveren' };
  }
  if (!process.env.CMS_API_KEY?.trim()) {
    return { ok: false, status: 503, error: 'CMS_API_KEY mangler på app-serveren' };
  }
  if (!agentKey) {
    return { ok: false, status: 503, error: 'CMS_AGENT_API_KEY eller CMS_API_KEY mangler for utkast' };
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
      cmsStatus: existing.cmsStatus,
    };
  }

  const categorySlug = normalizeBlogSlug(input.category || 'forklart');
  let categoryId: string | null;
  try {
    categoryId = await findCategoryId(categorySlug);
  } catch (error) {
    if (error instanceof CmsFetchError) {
      return { ok: false, status: 503, error: 'CMS-kategorioppslag feilet' };
    }
    throw error;
  }
  if (!categoryId) {
    return { ok: false, status: 400, error: 'Ukjent kategori' };
  }

  const suggested = (input.suggested_tags ?? input.tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);

  const relatedSakIds = (input.related_sak_ids ?? [])
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 8);
  const relatedHoringIds = (input.related_horing_ids ?? [])
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 8);

  const excerpt = normalizeBlogExcerpt(input.excerpt);
  const blueskyText = normalizeBlueskyText(excerpt, input.bluesky_text);

  const body = {
    slug,
    title: normalizeBlogTitle(input.title),
    excerpt,
    bodyMarkdown: input.body_md,
    category: categoryId,
    relatedSakIds: relatedSakIds.map((id) => ({ id })),
    relatedHoringIds: relatedHoringIds.map((id) => ({ id })),
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
    review: {
      state: 'til_vurdering',
      ...(input.review_note ? { note: input.review_note } : {}),
    },
  };

  const created = await payloadCreatePost('/api/posts?draft=true', body);
  if (!created.ok) {
    return { ok: false, status: created.status, error: created.error };
  }

  const { doc } = created;
  if (doc._status && doc._status !== 'draft') {
    console.error('[blog] CMS returnerte ikke-utkast ved opprettelse', {
      id: doc.id,
      slug: doc.slug,
      _status: doc._status,
    });
    const adminUrl = `${base}/admin/collections/posts/${doc.id}`;
    return {
      ok: false,
      status: 502,
      error:
        'Innlegget ble lagret i CMS, men ble publisert — forventet utkast (sjekk CMS-status)',
      id: doc.id,
      slug: doc.slug,
      adminUrl,
      cmsStatus: 'published',
    };
  }

  return {
    ok: true,
    id: doc.id,
    slug: doc.slug,
    created: true,
    adminUrl: `${base}/admin/collections/posts/${doc.id}`,
    cmsStatus: 'draft',
  };
}

export async function markBlogSocialPosted(
  slug: string,
  blueskyUri?: string | null,
): Promise<boolean> {
  if (!getCmsBaseUrl() || !process.env.REVALIDATE_SECRET?.trim()) return false;
  return cmsBlogOpsSocialPosted(slug, blueskyUri);
}

export function cmsAdminUrlForPost(id: string): string | null {
  const base = getCmsBaseUrl();
  if (base) return `${base}/admin/collections/posts/${id}`;
  return adminBlogPostUrl(id);
}
