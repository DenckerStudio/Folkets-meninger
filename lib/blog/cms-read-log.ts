export type BloggCmsReadDel = 'featured' | 'list' | 'categories' | 'loader';

function safeBloggErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  // Unngå query-strenger og signede URL-er i logger.
  return raw.split('?')[0]?.trim() ?? raw;
}

/** Serverlogg for CMS-lesing på /blogg — ingen secrets eller token-URL-er. */
export function logBloggCmsReadFailure(del: BloggCmsReadDel, error: unknown): void {
  const message = safeBloggErrorMessage(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error('[blogg] CMS-lesing feilet', { message, stack, del });
}