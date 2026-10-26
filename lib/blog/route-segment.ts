import { swallowBlogCmsErrorAtBuild } from '@/lib/blog/cms-read-runtime';
import { listPublishedBlogSlugsForSitemap } from '@/lib/blog/service';
import { isCmsConfigured } from '@/lib/cms/payload-client';

export async function blogGenerateStaticParams(): Promise<{ slug: string }[]> {
  if (!isCmsConfigured()) return [];
  try {
    const slugs = await listPublishedBlogSlugsForSitemap(50);
    return slugs.map((entry) => ({ slug: entry.slug }));
  } catch (error) {
    if (swallowBlogCmsErrorAtBuild(error)) return [];
    throw error;
  }
}
