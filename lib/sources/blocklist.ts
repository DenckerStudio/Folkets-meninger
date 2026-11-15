import { isUnpublishableSourceHost } from '@/lib/admin/research/topic-brief-schema';

/** Domains that must never appear in public or admin source lists. */
const EXTRA_BLOCKED_HOST_SUFFIXES = [
  'redd.it',
  'reddit.com',
  'arctic-shift.com',
] as const;

export function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export function isBlockedSourceUrl(url: string): boolean {
  if (isUnpublishableSourceHost(url)) return true;
  const host = hostnameFromUrl(url);
  if (!host) return true;
  return EXTRA_BLOCKED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

export function filterBlockedSourceHits<T extends { url: string }>(hits: readonly T[]): T[] {
  return hits.filter((hit) => !isBlockedSourceUrl(hit.url));
}