import 'server-only';

import {
  computeOverviewEtag,
  LOCAL_AI_OVERVIEW_CACHE_TTL_MS,
  type LocalAiOverviewCacheEntry,
  readOverviewCache,
  resolveOverviewBypassRequest,
  writeOverviewCache,
} from '@/lib/admin/local-ai-hub/overview-cache-store';
import { coalesceOverviewCacheLoad } from '@/lib/admin/local-ai-hub/overview-cache-inflight';
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
  refreshThrottled?: boolean;
};

async function buildOverviewCacheResponse(
  nowMs: number,
): Promise<LocalAiOverviewCachedResponse> {
  const result = await loadLocalAiOverview();
  const serialized = JSON.stringify(result);
  const etag = computeOverviewEtag(serialized);
  const entry: LocalAiOverviewCacheEntry = {
    result,
    etag,
    expiresAt: nowMs + LOCAL_AI_OVERVIEW_CACHE_TTL_MS,
    cachedAtMs: nowMs,
  };
  writeOverviewCache(entry);
  return { result, etag, fromCache: false };
}

export async function loadLocalAiOverviewCached(
  options: LoadLocalAiOverviewCachedOptions = {},
): Promise<LocalAiOverviewCachedResponse> {
  const nowMs = options.nowMs ?? Date.now();
  const { effectiveBypass, servedFromYoungCache } = resolveOverviewBypassRequest(
    nowMs,
    Boolean(options.bypassCache),
  );

  if (!effectiveBypass) {
    const cached = readOverviewCache(nowMs);
    if (cached) {
      return {
        result: cached.result,
        etag: cached.etag,
        fromCache: true,
        refreshThrottled: servedFromYoungCache ? true : undefined,
      };
    }
  }

  return coalesceOverviewCacheLoad(async () => {
    const innerNow = options.nowMs ?? Date.now();
    if (!effectiveBypass) {
      const cachedAgain = readOverviewCache(innerNow);
      if (cachedAgain) {
        return {
          result: cachedAgain.result,
          etag: cachedAgain.etag,
          fromCache: true,
          refreshThrottled: servedFromYoungCache ? true : undefined,
        };
      }
    }
    return buildOverviewCacheResponse(innerNow);
  });
}

export function shouldBypassOverviewCacheFromRequest(request: Request): boolean {
  return request.headers.get(LOCAL_AI_OVERVIEW_REFRESH_HEADER) === '1';
}