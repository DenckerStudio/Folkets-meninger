import { unstable_noStore as noStore } from 'next/cache';
import { BlogCmsUnavailable } from '@/components/blog/blog-cms-unavailable';

/**
 * Build-time CMS outage must not be ISR-cached for an hour alongside a healthy index.
 * Opting out of static caching keeps the shell fresh until CMS responds.
 */
export function BlogCmsUnavailableShell() {
  noStore();
  return <BlogCmsUnavailable />;
}
