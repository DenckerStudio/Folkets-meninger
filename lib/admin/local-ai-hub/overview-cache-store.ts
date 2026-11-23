import { createHash } from 'node:crypto';

import type { LocalAiOverviewResult } from '@/lib/admin/local-ai-hub/overview-types';

export const LOCAL_AI_OVERVIEW_CACHE_TTL_MS = 45_000;

export type LocalAiOverviewCacheEntry = {
  result: LocalAiOverviewResult;
  etag: string;
  expiresAt: number;
};

let activeEntry: LocalAiOverviewCacheEntry | null = null;

export function computeOverviewEtag(serializedBody: string): string {
  const digest = createHash('sha256').update(serializedBody).digest('hex').slice(0, 32);
  return `"${digest}"`;
}

export function readOverviewCache(nowMs: number): LocalAiOverviewCacheEntry | null {
  if (!activeEntry || activeEntry.expiresAt <= nowMs) {
    return null;
  }
  return activeEntry;
}

export function writeOverviewCache(entry: LocalAiOverviewCacheEntry): void {
  activeEntry = entry;
}

export function clearOverviewCacheForTests(): void {
  activeEntry = null;
}

export function ifNoneMatchAllows304(ifNoneMatchHeader: string | null, etag: string): boolean {
  if (!ifNoneMatchHeader?.trim()) return false;
  const normalizedEtag = etag.trim();
  for (const token of ifNoneMatchHeader.split(',')) {
    const candidate = token.trim().replace(/^W\//, '');
    if (candidate === '*') return true;
    if (candidate === normalizedEtag) return true;
  }
  return false;
}