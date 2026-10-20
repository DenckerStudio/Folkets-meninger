import { absoluteUrl } from '@/lib/seo/metadata';

export const BLOG_BASE_PATH = '/blogg';

export function blogIndexPath(): string {
  return BLOG_BASE_PATH;
}

export function blogPostPath(slug: string): string {
  return `${BLOG_BASE_PATH}/${encodeURIComponent(slug)}`;
}

export function blogPostCanonicalUrl(slug: string): string {
  return absoluteUrl(blogPostPath(slug));
}

export function blogPostOgImagePath(slug: string): string {
  return `${blogPostPath(slug)}/opengraph-image`;
}

export function blogRssPath(): string {
  return `${BLOG_BASE_PATH}/rss.xml`;
}

/** Payload-admin for a post; null when CMS_URL is unset (no public fallback). */
export function adminBlogPostUrl(postId: string): string | null {
  const base = process.env.CMS_URL?.replace(/\/+$/, '');
  if (base) return `${base}/admin/collections/posts/${postId}`;
  return null;
}
