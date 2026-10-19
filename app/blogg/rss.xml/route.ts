import { buildBlogRssFeed } from '@/lib/blog/rss';
import { listPublishedBlogPosts } from '@/lib/blog/service';
import { CmsFetchError } from '@/lib/cms/cms-fetch-error';

export const dynamic = 'force-dynamic';

const RETRY_AFTER_SECONDS = 300;

export async function GET() {
  try {
    const posts = await listPublishedBlogPosts(100);
    const xml = buildBlogRssFeed(posts);
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    });
  } catch (error) {
    if (error instanceof CmsFetchError) {
      const xml = buildBlogRssFeed([]);
      return new Response(xml, {
        status: 503,
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': String(RETRY_AFTER_SECONDS),
        },
      });
    }
    throw error;
  }
}
