import type { ChangelogEntry } from '@/lib/appens-fremtid/constants';

/** Fremtidig `published_at` — skjules av RLS-policy `published_at <= now()`. */
export const CHANGELOG_DRAFT_PUBLISHED_AT = '2099-12-31T23:59:59.000Z';

export function isChangelogPublished(entry: ChangelogEntry): boolean {
  const at = entry.publishedAt ?? entry.createdAt;
  if (!at) return false;
  return new Date(at).getTime() <= Date.now();
}

export function changelogPublishLabel(entry: ChangelogEntry): 'Publisert' | 'Utkast' {
  return isChangelogPublished(entry) ? 'Publisert' : 'Utkast';
}
