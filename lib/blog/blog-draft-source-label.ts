export function formatBlogDraftSourceLabel(
  source: Pick<{ title: string; publisher: string; publishedAt?: string | null }, 'title' | 'publisher' | 'publishedAt'>,
): string {
  const title = source.title.trim();
  const publisher = source.publisher.trim() || 'Ukjent utgiver';
  const date = source.publishedAt?.trim();
  if (date) {
    return `${title} (${publisher}, ${date})`;
  }
  return `${title} (${publisher})`;
}