export type N8nWebhookKind =
  | 'ai-summary'
  | 'document-embeddings'
  | 'system-poll-draft'
  | 'hearing-innspill';

export type TriggerN8nWebhookOptions = {
  kind: N8nWebhookKind;
  url: string | undefined;
  body: unknown;
  timeoutMs?: number;
  attempts?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_ATTEMPTS = 2;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postN8nWebhook(
  url: string,
  body: unknown,
  kind: N8nWebhookKind,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  attempts = DEFAULT_ATTEMPTS,
): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });
      if (res.ok || res.status === 409) {
        return true;
      }
      console.warn(`[n8n] ${kind} webhook HTTP ${res.status} (attempt ${attempt}/${attempts})`);
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      console.warn(
        `[n8n] ${kind} webhook ${aborted ? 'timed out' : 'failed'} (attempt ${attempt}/${attempts})`,
        aborted ? undefined : err,
      );
    } finally {
      clearTimeout(abortTimer);
    }
    if (attempt < attempts) {
      await delay(400 * attempt);
    }
  }
  console.warn(`[n8n] ${kind} webhook exhausted retries; cron /api/cron/n8n-retry can re-queue`);
  return false;
}

/**
 * Fire-and-forget n8n webhook. Returns false when the URL is missing so callers
 * can keep pending flags and let cron retry. Never invents an in-app LLM.
 */
export function triggerN8nWebhook(options: TriggerN8nWebhookOptions): boolean {
  const url = options.url?.trim();
  if (!url) {
    console.warn(`[n8n] ${options.kind} webhook not configured`);
    return false;
  }

  void postN8nWebhook(
    url,
    options.body,
    options.kind,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    options.attempts ?? DEFAULT_ATTEMPTS,
  );
  return true;
}
