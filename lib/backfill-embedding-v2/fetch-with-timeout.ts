export const EMBED_HTTP_TIMEOUT_MESSAGE = 'Embed HTTP-forespørsel avbrutt (timeout)';

export type FetchWithTimeoutOptions = {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

/**
 * fetch with AbortController deadline. Aborts count as retryable batch errors upstream.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  options: FetchWithTimeoutOptions,
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  const signal = init.signal;
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          controller.abort();
        },
        { once: true },
      );
    }
  }

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(EMBED_HTTP_TIMEOUT_MESSAGE);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
