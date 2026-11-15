import {
  buildPublicSearchQuery,
  type PublicQueryDeps,
} from '@/lib/sources/build-public-search-query';
import { mergeSourceHits } from '@/lib/sources/normalize';
import { createDefaultPublicQueryDeps } from '@/lib/sources/public-query-loaders';
import { searchStortingetSources } from '@/lib/sources/stortinget-search';
import type { NormalizedSourceHit, PublicSearchScope } from '@/lib/sources/types';
import { isWebSearchEnabled, searchWebSources } from '@/lib/sources/web-search';

export type FindMoreSourcesResult =
  | {
      ok: true;
      query: string;
      results: NormalizedSourceHit[];
      webSearchEnabled: boolean;
      webSearchAttempted: boolean;
      webSearchError: string | null;
    }
  | {
      ok: false;
      code: 'not_found' | 'no_public_terms' | 'query_failed';
      message: string;
    };

export type FindMoreSourcesOptions = {
  deps?: PublicQueryDeps;
  stortingetLimit?: number;
  webLimit?: number;
  totalLimit?: number;
  fetchImpl?: typeof fetch;
};

/**
 * Combined Stortinget hybrid hits + optional self-hosted web search (WEB_SEARCH_URL).
 * Exported for admin research and future blog-draft flows.
 */
export async function findMoreSources(
  scope: PublicSearchScope,
  options: FindMoreSourcesOptions = {},
): Promise<FindMoreSourcesResult> {
  const deps = options.deps ?? createDefaultPublicQueryDeps();
  const built = await buildPublicSearchQuery(scope, deps);
  if (!built.ok) {
    return {
      ok: false,
      code: built.code === 'not_found' ? 'not_found' : 'no_public_terms',
      message: built.message,
    };
  }

  const webEnabled = isWebSearchEnabled();
  const [stortinget, webRes] = await Promise.all([
    searchStortingetSources(built.query, {
      issueId: built.issueId,
      limit: options.stortingetLimit ?? 10,
    }),
    webEnabled
      ? searchWebSources(built.query, {
          limit: options.webLimit ?? 8,
          fetchImpl: options.fetchImpl,
        })
      : Promise.resolve({ ok: false as const, error: '', disabled: true }),
  ]);

  const webHits = webRes.ok ? webRes.results : [];
  const results = mergeSourceHits(
    stortinget,
    webHits,
    options.totalLimit ?? 24,
  );

  if (results.length === 0) {
    return {
      ok: false,
      code: 'query_failed',
      message: 'Ingen treff for offentlige søkeord',
    };
  }

  return {
    ok: true,
    query: built.query,
    results,
    webSearchEnabled: webEnabled,
    webSearchAttempted: webEnabled,
    webSearchError:
      webEnabled && !webRes.ok && !webRes.disabled ? webRes.error : null,
  };
}