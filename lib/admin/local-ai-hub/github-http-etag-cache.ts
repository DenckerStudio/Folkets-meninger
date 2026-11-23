export const GITHUB_HTTP_ETAG_CACHE_MAX_KEYS = 500;

export type GithubHttpEtagCacheEntry = {
  etag: string;
  bodyText: string;
  linkHeader?: string | null;
};

const store = new Map<string, GithubHttpEtagCacheEntry>();

export function githubHttpCacheKey(url: string, method = 'GET'): string {
  return `${method}:${url}`;
}

export function readGithubHttpEtagCache(cacheKey: string): GithubHttpEtagCacheEntry | null {
  const entry = store.get(cacheKey);
  if (!entry) {
    return null;
  }
  store.delete(cacheKey);
  store.set(cacheKey, entry);
  return entry;
}

export function writeGithubHttpEtagCache(cacheKey: string, entry: GithubHttpEtagCacheEntry): void {
  if (store.has(cacheKey)) {
    store.delete(cacheKey);
  }
  store.set(cacheKey, entry);
  while (store.size > GITHUB_HTTP_ETAG_CACHE_MAX_KEYS) {
    const oldest = store.keys().next().value as string | undefined;
    if (oldest === undefined) {
      break;
    }
    store.delete(oldest);
  }
}

export function clearGithubHttpEtagCacheForTests(): void {
  store.clear();
}

export function githubHttpEtagCacheSizeForTests(): number {
  return store.size;
}