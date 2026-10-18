export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: { attempts?: number; baseDelayMs?: number } = {},
): Promise<Response> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 400;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('fetchWithRetry failed');
}
