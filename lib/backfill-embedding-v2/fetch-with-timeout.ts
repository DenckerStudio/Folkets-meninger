export const EMBED_HTTP_TIMEOUT_MESSAGE = 'Embed HTTP-forespørsel avbrutt (timeout)';

export type FetchWithTimeoutOptions = {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

function chainAbortSignals(
  controller: AbortController,
  timer: ReturnType<typeof setTimeout>,
  parent?: AbortSignal | null,
): void {
  if (!parent) {
    return;
  }
  if (parent.aborted) {
    clearTimeout(timer);
    controller.abort();
    return;
  }
  parent.addEventListener(
    'abort',
    () => {
      clearTimeout(timer);
      controller.abort();
    },
    { once: true },
  );
}

function rethrowFetchTimeout(err: unknown): never {
  if (err instanceof Error && err.name === 'AbortError') {
    throw new Error(EMBED_HTTP_TIMEOUT_MESSAGE);
  }
  throw err;
}

/**
 * fetch with AbortController deadline. Aborts count as retryable batch errors upstream.
 * The timer stays armed until the caller finishes reading the body (use fetchJsonWithTimeout).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  options: FetchWithTimeoutOptions,
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  chainAbortSignals(controller, timer, init.signal ?? null);

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (err) {
    rethrowFetchTimeout(err);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST (or any method) + JSON body parse under one AbortController deadline (includes body read).
 */
export async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  options: FetchWithTimeoutOptions,
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  chainAbortSignals(controller, timer, init.signal ?? null);

  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    rethrowFetchTimeout(err);
  } finally {
    clearTimeout(timer);
  }
}
