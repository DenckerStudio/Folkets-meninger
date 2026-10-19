import { unstable_noStore as noStore } from 'next/cache';
import { CmsFetchError } from '@/lib/cms/cms-fetch-error';
import type { PayloadListResponse } from '@/lib/cms/types';

const DEFAULT_REVALIDATE = 3600;

export { CmsFetchError } from '@/lib/cms/cms-fetch-error';

export function isCmsConfigured(): boolean {
  return Boolean(process.env.CMS_URL?.trim() && process.env.CMS_API_KEY?.trim());
}

export function getCmsBaseUrl(): string | null {
  const url = process.env.CMS_URL?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, '');
}

export function getCmsAgentKey(): string | null {
  return (
    process.env.CMS_AGENT_API_KEY?.trim() ||
    process.env.CMS_API_KEY?.trim() ||
    null
  );
}

type FetchOptions = {
  revalidate?: number;
  tags?: string[];
  apiKey?: string;
  method?: string;
  body?: unknown;
  /** When true, skip noStore (e.g. rare non-page reads). Blog reads default to dynamic. */
  allowIsrCache?: boolean;
};

export async function payloadFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const base = getCmsBaseUrl();
  const apiKey = options.apiKey ?? process.env.CMS_API_KEY?.trim();
  if (!base || !apiKey) {
    throw new CmsFetchError('CMS er ikke konfigurert', 'unconfigured');
  }

  if (!options.allowIsrCache) {
    noStore();
  }

  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `users API-Key ${apiKey}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: options.allowIsrCache ? undefined : 'no-store',
      next: options.allowIsrCache
        ? {
            revalidate: options.revalidate ?? DEFAULT_REVALIDATE,
            tags: options.tags ?? ['blog'],
          }
        : undefined,
    });
    if (!res.ok) {
      throw new CmsFetchError(`CMS returnerte HTTP ${res.status}`, 'http');
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof CmsFetchError) throw error;
    console.error('[cms] fetch failed', path, error);
    throw new CmsFetchError('CMS forespørsel feilet', 'network');
  }
}

export async function payloadFetchList<T>(
  collection: string,
  query: Record<string, string | number | boolean | undefined>,
  options?: FetchOptions,
): Promise<PayloadListResponse<T>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  return payloadFetch<PayloadListResponse<T>>(`/api/${collection}?${params.toString()}`, options);
}
