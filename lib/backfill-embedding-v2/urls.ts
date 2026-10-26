/** Normalize embed service origin for comparison (host + port). */
export function embedOrigin(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    return `${parsed.hostname}:${port}`;
  } catch {
    return null;
  }
}

export function buildEmbedApiUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl.trim());
  const path = parsed.pathname.replace(/\/$/, '');
  parsed.pathname = path.endsWith('/api/embed') ? path : `${path}/api/embed`;
  return parsed.toString();
}

export function isGpuOllamaUrl(url: string): boolean {
  const origin = embedOrigin(url);
  return origin?.endsWith(':11434') ?? false;
}

export function isChatQueryEmbedUrl(backfillUrl: string, queryUrl: string | undefined): boolean {
  const back = embedOrigin(backfillUrl);
  if (!back) return false;
  if (back.endsWith(':11435')) return true;
  const query = queryUrl?.trim();
  if (!query) return false;
  const qOrigin = embedOrigin(query);
  return Boolean(qOrigin && qOrigin === back);
}

export type EmbedUrlStartupCheck = {
  chatInstance: boolean;
  gpuInstance: boolean;
  busyPauseDefault: boolean;
  warnings: string[];
};

export function checkEmbedUrlsAtStartup(
  backfillUrl: string,
  queryUrl: string | undefined,
  allowGpu: boolean,
  busyPauseFlag: boolean | undefined,
): EmbedUrlStartupCheck {
  const warnings: string[] = [];
  const gpuInstance = isGpuOllamaUrl(backfillUrl);
  const chatInstance = isChatQueryEmbedUrl(backfillUrl, queryUrl);

  if (gpuInstance && !allowGpu) {
    throw new Error(
      'EMBED_BACKFILL_URL peker på GPU-instansen (:11434). Bruk --allow-gpu kun hvis du vet at gemma ikke kastes ut.',
    );
  }

  if (chatInstance) {
    warnings.push(
      'EMBED_BACKFILL_URL deler chat-spørringsembedding-instansen (EMBED_QUERY_URL / :11435). ' +
        'Busy-pause er på som standard for å beskytte 800 ms spørrings-embeddings.',
    );
  }

  const busyPauseDefault =
    busyPauseFlag !== undefined ? busyPauseFlag : chatInstance ? true : false;

  return { chatInstance, gpuInstance, busyPauseDefault, warnings };
}
