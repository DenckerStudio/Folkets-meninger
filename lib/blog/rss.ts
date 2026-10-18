import { BLOG_AUTHOR_LABEL } from '@/lib/blog/types';
import { blogPostCanonicalUrl, blogRssPath } from '@/lib/blog/urls';
import type { BlogPostPublic } from '@/lib/blog/types';
import { SITE_NAME, getSiteUrl } from '@/lib/seo/metadata';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildBlogRssFeed(posts: BlogPostPublic[]): string {
  const site = getSiteUrl();
  const feedUrl = `${site}${blogRssPath()}`;
  const items = posts
    .map((post) => {
      const link = blogPostCanonicalUrl(post.slug);
      const pubDate = post.published_at ? new Date(post.published_at).toUTCString() : '';
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <author>${escapeXml(BLOG_AUTHOR_LABEL)}</author>
    </item>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)} — Blogg</title>
    <link>${escapeXml(`${site}/blogg`)}</link>
    <description>Nyheter og forklaringer fra ${escapeXml(SITE_NAME)}.</description>
    <language>nb-no</language>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;
}
