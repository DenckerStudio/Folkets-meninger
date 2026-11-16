import { logBloggCmsReadFailure } from '@/lib/blog/cms-read-log';
import { CmsFetchError } from '@/lib/cms/cms-fetch-error';
import { isNextProductionBuildPhase } from '@/lib/cms/next-build-phase';

export type BlogCmsPageLoad<T> =
  | { unavailable: true }
  | { unavailable: false; data: T };

/**
 * CMS read failures render a soft-unavailable blog shell instead of HTTP 500.
 * During `next build`, the same path keeps deploy green when Payload is down.
 */
export async function blogCmsOrUnavailable<T>(
  loader: () => Promise<T>,
): Promise<BlogCmsPageLoad<T>> {
  try {
    return { unavailable: false, data: await loader() };
  } catch (error) {
    if (error instanceof CmsFetchError) {
      logBloggCmsReadFailure('loader', error);
      return { unavailable: true };
    }
    throw error;
  }
}

export function swallowBlogCmsErrorAtBuild(error: unknown): boolean {
  return error instanceof CmsFetchError && isNextProductionBuildPhase();
}
