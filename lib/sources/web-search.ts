import type { NormalizedSourceHit } from '@/lib/sources/types';
import { filterBlockedSourceHits, hostnameFromUrl } from '@/lib/sources/blocklist';

let loggedMissingWebSearchUrl = false;

function logMissingWebSearchUrlOnce(): void {
  if (loggedMissingWebSearchUrl) return;
  loggedMissingWebSearchUrl = true;
  console.warn('[sources] WEB_SEARCH_URL mangler – nettsøk for kilder er av');
}

export function resetWebSearchLogForTests(): void {
  loggedMissingWebSearchUrl = false;
}

export function getWebSearchBaseUrl(): string | null {
  const raw = process.env.WEB_SEARCH_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return raw;
  } catch {
    return null;
  }
}

export function isWebSearchEnabled(): boolean {
  return getWebSearchBaseUrl() !== null;
}

export function buildWebSearchRequestUrl(query: string, baseUrl?: string): string {
  const resolved = baseUrl?.trim() || getWebSearchBaseUrl();
  if (!resolved) {
    throw new Error('WEB_SEARCH_URL mangler');
  }
  const url = new URL('/search', resolved);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('language', 'nb-NO');
  url.searchParams.set('categories', 'general');
  return url.toString();
}

function readPublishedAt(row: Record<string, unknown>): string | undefined {
  const raw =
    (typeof row.publishedDate === 'string' && row.publishedDate) ||
    (typeof row.published_date === 'string' && row.published_date) ||
    (typeof row.pubdate === 'string' && row.pubdate) ||
    '';
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export type WebSearchOptions = {
  timeoutMs?: number;
  limit?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
};

export async function searchWebSources(
  query: string,
  options: WebSearchOptions = {},
): Promise<
  | { ok: true; results: NormalizedSourceHit[] }
  | { ok: false; error: string; disabled?: boolean }
> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, error: 'Mangler søkestreng' };
  }

  const baseUrl = options.baseUrl ?? getWebSearchBaseUrl();
  if (!baseUrl) {
    logMissingWebSearchUrlOnce();
    return { ok: false, error: 'Nettsøk er ikke konfigurert', disabled: true };
  }

  const timeoutMs = options.timeoutMs ?? 8_000;
  const limit = options.limit ?? 8;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(buildWebSearchRequestUrl(trimmed, baseUrl), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Søketjenesten svarte med ${response.status}. Prøv igjen senere.`,
      };
    }

    const json = (await response.json()) as { results?: unknown };
    const results = Array.isArray(json.results) ? json.results : [];
    const hits: NormalizedSourceHit[] = [];

    for (const item of results) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      const url = typeof row.url === 'string' ? row.url.trim() : '';
      const snippet =
        typeof row.content === 'string'
          ? row.content.trim()
          : typeof row.snippet === 'string'
            ? row.snippet.trim()
            : '';
      if (!title || !url) continue;
      const domain = hostnameFromUrl(url) ?? '';
      hits.push({
        title,
        url,
        domain,
        snippet: snippet.slice(0, 320),
        publishedAt: readPublishedAt(row),
        sourceType: 'web',
      });
      if (hits.length >= limit) break;
    }

    return { ok: true, results: filterBlockedSourceHits(hits) };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: 'Søket tok for lang tid. Prøv igjen senere.' };
    }
    return { ok: false, error: 'Kunne ikke nå nettsøk akkurat nå.' };
  } finally {
    clearTimeout(timer);
  }
}