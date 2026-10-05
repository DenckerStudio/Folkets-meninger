export const DEFAULT_SEARXNG_BASE_URL = 'https://searxng.heyklever.app';

export type SearxngHit = {
  title: string;
  url: string;
  snippet: string;
};

export function getSearxngBaseUrl(): string {
  return process.env.SEARXNG_BASE_URL?.trim() || DEFAULT_SEARXNG_BASE_URL;
}

export function buildSearxngSearchUrl(query: string, baseUrl = getSearxngBaseUrl()): string {
  const url = new URL('/search', baseUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('language', 'nb-NO');
  url.searchParams.set('categories', 'general');
  return url.toString();
}

export async function searchSearxng(
  query: string,
  options?: { timeoutMs?: number; limit?: number },
): Promise<{ ok: true; results: SearxngHit[] } | { ok: false; error: string }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, error: 'Mangler søkestreng' };
  }

  const timeoutMs = options?.timeoutMs ?? 8000;
  const limit = options?.limit ?? 6;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildSearxngSearchUrl(trimmed), {
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
    const hits: SearxngHit[] = [];

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
      hits.push({ title, url, snippet: snippet.slice(0, 320) });
      if (hits.length >= limit) break;
    }

    return { ok: true, results: hits };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: 'Søket tok for lang tid. Kilder er midlertidig utilgjengelige.' };
    }
    return { ok: false, error: 'Kunne ikke nå SearXNG akkurat nå. Kilder er midlertidig utilgjengelige.' };
  } finally {
    clearTimeout(timer);
  }
}
