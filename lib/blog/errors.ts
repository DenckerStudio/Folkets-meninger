export function isBlogTableMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: string; message?: string };
  const message = (record.message ?? '').toLowerCase();
  if (record.code === '42P01') return true;
  if (message.includes('blog_posts') && message.includes('does not exist')) return true;
  if (record.code === 'PGRST205' && message.includes('blog_posts')) return true;
  return false;
}
