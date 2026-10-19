import type { MetadataRoute } from 'next';
import { CmsFetchError } from '@/lib/cms/cms-fetch-error';

export type BlogSitemapSlug = {
  slug: string;
  published_at: string | null;
  updated_at: string | null;
};

export function mapBlogSlugsToSitemapEntries(
  base: string,
  slugs: BlogSitemapSlug[],
): MetadataRoute.Sitemap {
  return slugs.map((entry) => ({
    url: `${base}/blogg/${encodeURIComponent(entry.slug)}`,
    lastModified: entry.updated_at
      ? new Date(entry.updated_at)
      : entry.published_at
        ? new Date(entry.published_at)
        : undefined,
    changeFrequency: 'monthly' as const,
    priority: 0.45,
  }));
}

export async function loadBlogSitemapEntriesWithCmsFallback(
  base: string,
  loadSlugs: () => Promise<BlogSitemapSlug[]>,
  log: Pick<Console, 'error'> = console,
): Promise<MetadataRoute.Sitemap> {
  try {
    const slugs = await loadSlugs();
    return mapBlogSlugsToSitemapEntries(base, slugs);
  } catch (error) {
    if (error instanceof CmsFetchError) {
      log.error('sitemap: blogg utilgjengelig i CMS — beholder statiske og sak-URL-er uten bloggposter', error);
      return [];
    }
    throw error;
  }
}
