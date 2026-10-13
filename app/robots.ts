import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/metadata';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/embed/',
          '/dashboard/admin',
          '/dashboard/min-side',
          '/dashboard/varsler',
          '/dashboard/chat',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}