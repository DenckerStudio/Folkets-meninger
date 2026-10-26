/** True when the requested page is past the last page (including empty blogs). */
export function isBlogPageOutOfRange(page: number, totalPages: number): boolean {
  if (!Number.isFinite(page) || page < 1) return true;
  if (totalPages === 0) return page > 1;
  return page > totalPages;
}
