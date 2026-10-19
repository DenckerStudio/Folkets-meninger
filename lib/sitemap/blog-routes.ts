import type { MetadataRoute } from 'next';

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
    log.error('sitemap: klarte ikke å hente bloggposter — beholder statiske og sak-URL-er', error);
    return [];
  }
}
