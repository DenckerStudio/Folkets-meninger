import { CmsFetchError } from '@/lib/cms/cms-fetch-error';
import { isNextProductionBuildPhase } from '@/lib/cms/next-build-phase';

export type BlogCmsPageLoad<T> =
  | { unavailable: true }
  | { unavailable: false; data: T };

/**
 * During `next build`, CMS outages render a soft-unavailable blog shell instead of failing deploy.
 * At runtime, CMS errors propagate so ISR can keep the last good HTML.
 */
export async function blogCmsOrUnavailable<T>(
  loader: () => Promise<T>,
): Promise<BlogCmsPageLoad<T>> {
  try {
    return { unavailable: false, data: await loader() };
  } catch (error) {
    if (error instanceof CmsFetchError && isNextProductionBuildPhase()) {
      return { unavailable: true };
    }
    throw error;
  }
}

export function swallowBlogCmsErrorAtBuild(error: unknown): boolean {
  return error instanceof CmsFetchError && isNextProductionBuildPhase();
}
