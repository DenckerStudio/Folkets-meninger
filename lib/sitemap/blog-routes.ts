import type { MetadataRoute } from 'next';

export type BlogSitemapSlug = {
  slug: string;
  published_at: string | null;
  updated_at: string | null;
};

function sitemapLastModified(
  updatedAt: string | null,
  publishedAt: string | null,
): Date | undefined {
  for (const raw of [updatedAt, publishedAt]) {
    if (!raw?.trim()) continue;
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return undefined;
}

export function mapBlogSlugsToSitemapEntries(
  base: string,
  slugs: BlogSitemapSlug[],
): MetadataRoute.Sitemap {
  return slugs.map((entry) => {
    const lastModified = sitemapLastModified(entry.updated_at, entry.published_at);
    return {
      url: `${base}/blogg/${encodeURIComponent(entry.slug)}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: 'monthly' as const,
      priority: 0.45,
    };
  });
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
