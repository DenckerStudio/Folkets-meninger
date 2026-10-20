import type { PayloadListResponse } from '@/lib/cms/types';

/** Valid CMS response with zero published posts (not a fetch failure). */
export function isGenuinelyEmptyBlogList<T extends { id: string }>(
  data: PayloadListResponse<T> | null,
): boolean {
  return data !== null && data.totalDocs === 0 && data.docs.length === 0;
}
