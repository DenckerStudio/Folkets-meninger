import type { CollectionAfterChangeHook } from 'payload';
import { buildSignedHeaders } from '@/lib/hmac';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

type PostDoc = {
  id: string | number;
  slug?: string;
  title?: string;
  excerpt?: string;
  tags?: Array<{ name?: string } | string>;
  publishedAt?: string;
  social?: { blueskyText?: string };
};

function tagNames(tags: PostDoc['tags']): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => (typeof tag === 'string' ? tag : tag?.name))
    .filter((name): name is string => Boolean(name?.trim()));
}

export const postPublishHooks: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const becamePublished = doc?._status === 'published' && previousDoc?._status !== 'published';

  if (!becamePublished) return doc;

  const post = doc as PostDoc;
  const slug = post.slug ?? '';
  const webBase = process.env.WEB_PUBLIC_URL?.replace(/\/+$/, '') || 'https://www.folkets-meninger.no';
  const revalidateUrl = process.env.WEB_REVALIDATE_URL?.trim();
  const revalidateSecret = process.env.REVALIDATE_SECRET?.trim();

  if (revalidateUrl && revalidateSecret) {
    const body = JSON.stringify({ slug, tags: ['blog', `blog:${slug}`] });
    try {
      await fetch(revalidateUrl, {
        method: 'POST',
        headers: buildSignedHeaders(body, revalidateSecret),
        body,
      });
    } catch (error) {
      req.payload.logger.error({ msg: 'revalidate failed', error, slug });
    }
  }

  const webhookUrl = process.env.BLOG_PUBLISHED_WEBHOOK_URL?.trim();
  const webhookSecret = process.env.BLOG_WEBHOOK_SIGNING_SECRET?.trim();
  if (webhookUrl && webhookSecret) {
    const payload = {
      event: 'post.published',
      id: String(post.id),
      slug,
      title: post.title ?? '',
      excerpt: post.excerpt ?? '',
      url: `${webBase}/blogg/${encodeURIComponent(slug)}`,
      tags: tagNames(post.tags),
      ogImageUrl: `${webBase}/blogg/${encodeURIComponent(slug)}/opengraph-image`,
      blueskyText: post.social?.blueskyText ?? '',
      publishedAt: post.publishedAt ?? new Date().toISOString(),
    };
    const body = JSON.stringify(payload);
    const headers = buildSignedHeaders(body, webhookSecret);
    void fetchWithRetry(webhookUrl, { method: 'POST', headers, body })
      .then((res) => {
        if (!res.ok) {
          req.payload.logger.error({
            msg: 'BLOG_PUBLISHED_WEBHOOK_URL non-ok',
            status: res.status,
            slug,
          });
        }
      })
      .catch((error) => {
        req.payload.logger.error({ msg: 'BLOG_PUBLISHED_WEBHOOK_URL failed', error, slug });
      });
  }

  return doc;
};
