import type { BlogCategory, BlogPostPublic, BlogPostListItem } from '@/lib/blog/types';
import type { PayloadAuthor, PayloadCategory, PayloadMedia, PayloadPost, PayloadTag } from '@/lib/cms/types';
import { getCmsBaseUrl } from '@/lib/cms/payload-client';
import { BLOG_AUTHOR_LABEL } from '@/lib/blog/types';

function resolveRelation<T extends { id?: string }>(value: T | string | null | undefined): T | null {
  if (!value || typeof value === 'string') return null;
  return value;
}

export function resolvePayloadPublishedAt(post: {
  publishedAt?: string | null;
  createdAt?: string | null;
}): string | null {
  const published = post.publishedAt?.trim();
  if (published) return published;
  const created = post.createdAt?.trim();
  if (created) return created;
  return null;
}

/** Same chronology as list sort (`-publishedAt` with createdAt fallback). */
export function payloadPostSortTimestamp(post: {
  publishedAt?: string | null;
  createdAt?: string | null;
}): number {
  const at = resolvePayloadPublishedAt(post);
  if (!at) return 0;
  const ms = new Date(at).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export function sortPayloadPostsByDisplayDate<T extends { publishedAt?: string | null; createdAt?: string | null }>(
  docs: T[],
): T[] {
  return docs.slice().sort((a, b) => payloadPostSortTimestamp(b) - payloadPostSortTimestamp(a));
}

function mediaUrl(media: PayloadMedia | string | null | undefined): string | null {
  if (!media || typeof media === 'string') return null;
  const relative = media.sizes?.card?.url || media.sizes?.hero?.url || media.url;
  if (!relative) return null;
  if (relative.startsWith('http')) return relative;
  const base = getCmsBaseUrl();
  return base ? `${base}${relative}` : relative;
}

export function mapPayloadPostToPublic(post: PayloadPost): BlogPostPublic {
  const category = resolveRelation<PayloadCategory>(post.category);
  const tags = (post.tags ?? [])
    .map((tag) => (typeof tag === 'string' ? tag : tag.slug || tag.name))
    .filter(Boolean) as string[];

  const authors = (post.authors ?? [])
    .map((author) => resolveRelation<PayloadAuthor>(author))
    .filter(Boolean) as PayloadAuthor[];

  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body_md: post.bodyMarkdown ?? '',
    tags,
    related_sak_ids: (post.relatedSakIds ?? []).map((row) => row.id).filter(Boolean),
    related_horing_ids: (post.relatedHoringIds ?? []).map((row) => row.id).filter(Boolean),
    published_at: resolvePayloadPublishedAt(post),
    updated_at:
      post.updatedAtDisplay ?? post.updatedAt ?? resolvePayloadPublishedAt(post) ?? null,
    category_slug: category?.slug ?? null,
    category_name: category?.name ?? null,
    featured: Boolean(post.featured),
    hero_image_url: mediaUrl(post.heroImage),
    reading_time_minutes: post.readingTimeMinutes ?? estimateReadingMinutes(post.bodyMarkdown),
    authors: authors.map((author) => ({
      name: author.name,
      slug: author.slug,
      kind: author.kind ?? 'organization',
      role: author.role ?? null,
      bio: author.bio ?? null,
    })),
    ai_assisted: Boolean(post.ai?.assisted),
    ai_model_family: post.ai?.modelFamily ?? null,
    seo_title: post.seo?.metaTitle ?? null,
    seo_description: post.seo?.metaDescription ?? null,
    author_label: authors[0]?.name ?? BLOG_AUTHOR_LABEL,
  };
}

export function mapPayloadPostToListItem(post: PayloadPost): BlogPostListItem {
  const publicPost = mapPayloadPostToPublic(post);
  return {
    ...publicPost,
    id: post.id,
  };
}

function estimateReadingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function mapPayloadCategories(docs: Array<PayloadCategory & { id: string }>): BlogCategory[] {
  return docs
    .map((doc) => ({
      name: doc.name,
      slug: doc.slug,
      description: doc.description ?? null,
      order: doc.order ?? 0,
    }))
    .sort((a, b) => a.order - b.order);
}
