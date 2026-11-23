import {
  githubHttpCacheKey,
  readGithubHttpEtagCache,
  writeGithubHttpEtagCache,
} from '@/lib/admin/local-ai-hub/github-http-etag-cache';

export type GithubConditionalJsonGetResult<T> =
  | { ok: true; data: T; servedFromConditionalCache: boolean; linkHeader: string | null }
  | { ok: false; error: string; status?: number };

export type GithubConditionalJsonGetOptions = {
  url: string;
  method?: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export async function githubConditionalJsonGet<T>(
  options: GithubConditionalJsonGetOptions,
): Promise<GithubConditionalJsonGetResult<T>> {
  const method = options.method ?? 'GET';
  if (method !== 'GET') {
    return { ok: false, error: 'Kun GET støttes for betinget GitHub-cache' };
  }

  const cacheKey = githubHttpCacheKey(options.url, method);
  const cached = readGithubHttpEtagCache(cacheKey);
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { ...options.headers };
  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  try {
    const res = await fetchImpl(options.url, {
      method,
      headers,
      signal: options.signal,
      cache: 'no-store',
    });

    if (res.status === 304) {
      if (!cached?.bodyText) {
        return { ok: false, error: 'GitHub svarte 304 uten lokalt cachet svar', status: 304 };
      }
      const data = JSON.parse(cached.bodyText) as T;
      return {
        ok: true,
        data,
        servedFromConditionalCache: true,
        linkHeader: cached.linkHeader ?? null,
      };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        error: text || `GitHub svarte med HTTP ${res.status}`,
        status: res.status,
      };
    }

    const bodyText = await res.text();
    const responseEtag = res.headers.get('etag');
    const linkHeader = res.headers.get('link');
    if (responseEtag && bodyText) {
      writeGithubHttpEtagCache(cacheKey, { etag: responseEtag, bodyText, linkHeader });
    }

    const data = JSON.parse(bodyText) as T;
    return { ok: true, data, servedFromConditionalCache: false, linkHeader };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukjent feil';
    return { ok: false, error: msg };
  }
}
