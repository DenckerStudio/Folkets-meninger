import { hostnameFromUrl } from '@/lib/sources/blocklist';
import type { NormalizedSourceHit } from '@/lib/sources/types';

export function canonicalSourceUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    let path = parsed.pathname.replace(/\/$/, '');
    if (!path) path = '/';
    parsed.pathname = path;
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function dedupeSourceHitsByUrl(hits: readonly NormalizedSourceHit[]): NormalizedSourceHit[] {
  const seen = new Set<string>();
  const out: NormalizedSourceHit[] = [];
  for (const hit of hits) {
    const key = canonicalSourceUrl(hit.url).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const domain = hit.domain.trim() || hostnameFromUrl(hit.url) || '';
    out.push({ ...hit, domain });
  }
  return out;
}

export function mergeSourceHits(
  stortinget: readonly NormalizedSourceHit[],
  web: readonly NormalizedSourceHit[],
  limit = 24,
): NormalizedSourceHit[] {
  return dedupeSourceHitsByUrl([...stortinget, ...web]).slice(0, Math.max(limit, 1));
}