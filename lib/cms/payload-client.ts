import type { PayloadListResponse } from '@/lib/cms/types';

const DEFAULT_REVALIDATE = 3600;

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
};

export async function payloadFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T | null> {
  const base = getCmsBaseUrl();
  const apiKey = options.apiKey ?? process.env.CMS_API_KEY?.trim();
  if (!base || !apiKey) return null;

  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `users API-Key ${apiKey}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      next: {
        revalidate: options.revalidate ?? DEFAULT_REVALIDATE,
        tags: options.tags ?? ['blog'],
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error('[cms] fetch failed', path, error);
    return null;
  }
}

export async function payloadFetchList<T>(
  collection: string,
  query: Record<string, string | number | boolean | undefined>,
  options?: FetchOptions,
): Promise<PayloadListResponse<T> | null> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  return payloadFetch<PayloadListResponse<T>>(`/api/${collection}?${params.toString()}`, options);
}
