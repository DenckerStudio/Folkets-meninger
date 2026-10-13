import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/dashboard/utforsk`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/dashboard/avstemninger`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/dashboard/folkets-meninger`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/dashboard/horinger`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/dashboard/politikere`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/dashboard/kalender`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${base}/dashboard/sporsmal`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/dashboard/appens-fremtid`, changeFrequency: 'weekly', priority: 0.4 },
    { url: `${base}/innspill`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  let sakRoutes: MetadataRoute.Sitemap = [];
  try {
    const { getSakerWithCache } = await import('@/lib/stortinget-saker-cache');
    const saker = await getSakerWithCache({ includeAll: false, preferDb: true });
    sakRoutes = saker.slice(0, 500).map((sak) => ({
      url: `${base}/dashboard/sak/${encodeURIComponent(sak.id)}`,
      lastModified: sak.date ? new Date(sak.date) : undefined,
      changeFrequency: 'daily',
      priority: 0.6,
    }));
  } catch (error) {
    console.error('sitemap: klarte ikke å hente saker', error);
  }

  return [...staticRoutes, ...sakRoutes];
}