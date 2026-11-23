import 'server-only';

import {
  computeOverviewEtag,
  LOCAL_AI_OVERVIEW_CACHE_TTL_MS,
  type LocalAiOverviewCacheEntry,
  readOverviewCache,
  writeOverviewCache,
} from '@/lib/admin/local-ai-hub/overview-cache-store';
import { loadLocalAiOverview } from '@/lib/admin/local-ai-hub/overview';
import { LOCAL_AI_OVERVIEW_REFRESH_HEADER } from '@/lib/admin/local-ai-hub/overview-client-refresh';
import type { LocalAiOverviewResult } from '@/lib/admin/local-ai-hub/overview-types';

export type LoadLocalAiOverviewCachedOptions = {
  bypassCache?: boolean;
  nowMs?: number;
};

export type LocalAiOverviewCachedResponse = {
  result: LocalAiOverviewResult;
  etag: string;
  fromCache: boolean;
};

export async function loadLocalAiOverviewCached(
  options: LoadLocalAiOverviewCachedOptions = {},
): Promise<LocalAiOverviewCachedResponse> {
  const nowMs = options.nowMs ?? Date.now();
  if (!options.bypassCache) {
    const cached = readOverviewCache(nowMs);
    if (cached) {
      return { result: cached.result, etag: cached.etag, fromCache: true };
    }
  }

  const result = await loadLocalAiOverview();
  const serialized = JSON.stringify(result);
  const etag = computeOverviewEtag(serialized);
  const entry: LocalAiOverviewCacheEntry = {
    result,
    etag,
    expiresAt: nowMs + LOCAL_AI_OVERVIEW_CACHE_TTL_MS,
  };
  writeOverviewCache(entry);
  return { result, etag, fromCache: false };
}

export function shouldBypassOverviewCacheFromRequest(request: Request): boolean {
  return request.headers.get(LOCAL_AI_OVERVIEW_REFRESH_HEADER) === '1';
}