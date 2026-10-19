const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeBlogSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function isValidBlogSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 120 && SLUG_PATTERN.test(slug);
}
