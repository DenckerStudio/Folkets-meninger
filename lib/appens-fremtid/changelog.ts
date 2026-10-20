import type { ChangelogEntry } from '@/lib/appens-fremtid/constants';

export function isChangelogPublished(entry: ChangelogEntry): boolean {
  if (entry.publicationStatus === 'published') return true;
  if (entry.publicationStatus === 'draft') return false;
  const at = entry.publishedAt ?? entry.createdAt;
  if (!at) return false;
  return new Date(at).getTime() <= Date.now();
}

export function changelogPublishLabel(entry: ChangelogEntry): 'Publisert' | 'Utkast' {
  return isChangelogPublished(entry) ? 'Publisert' : 'Utkast';
}

/** Display timestamp for admin list (never shows sentinel draft dates). */
export function changelogDisplayWhen(entry: ChangelogEntry): string {
  if (isChangelogPublished(entry) && entry.publishedAt) return entry.publishedAt;
  return entry.createdAt;
}
