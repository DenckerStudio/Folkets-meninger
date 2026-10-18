import { blogPostOgImagePath, blogPostPath } from '@/lib/blog/urls';
import { absoluteUrl } from '@/lib/seo/metadata';
import type { BlogPostRow } from '@/lib/blog/types';

export type BlogPublishedWebhookPayload = {
  slug: string;
  title: string;
  excerpt: string;
  url: string;
  tags: string[];
  ogImageUrl: string;
};

export function buildBlogPublishedWebhookPayload(post: BlogPostRow): BlogPublishedWebhookPayload {
  const path = blogPostPath(post.slug);
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    url: absoluteUrl(path),
    tags: post.tags ?? [],
    ogImageUrl: absoluteUrl(blogPostOgImagePath(post.slug)),
  };
}

export function fireBlogPublishedWebhook(post: BlogPostRow): void {
  const url = process.env.BLOG_PUBLISHED_WEBHOOK_URL?.trim();
  if (!url) return;

  const payload = buildBlogPublishedWebhookPayload(post);
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.error('[blog] BLOG_PUBLISHED_WEBHOOK_URL failed', { slug: post.slug, error });
  });
}
