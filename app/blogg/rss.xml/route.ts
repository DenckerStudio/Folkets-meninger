import { buildBlogRssFeed } from '@/lib/blog/rss';
import { listPublishedBlogPosts } from '@/lib/blog/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const posts = await listPublishedBlogPosts(100);
  const xml = buildBlogRssFeed(posts);
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
