/**
 * Shared Ollama /api/generate request body + response helpers for eval tooling.
 */

export type OllamaGeneratePayload = {
  response?: string;
  thinking?: string;
  eval_count?: number;
  done_reason?: string;
};

/** Prefer `response`; fall back to `thinking` (qwen3-vl / thinking models with empty response). */
export function resolveOllamaGenerateText(payload: OllamaGeneratePayload): string {
  const response = (payload.response ?? '').trim();
  if (response) return response;
  return (payload.thinking ?? '').trim();
}

export function resolveOllamaThinkFlag(envKey: string, defaultThink = false): boolean {
  const raw = process.env[envKey];
  if (raw === undefined || raw === '') return defaultThink;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return defaultThink;
}

export function buildOllamaGenerateBody(args: {
  model: string;
  prompt: string;
  think: boolean;
  stream?: boolean;
  numPredict?: number;
  format?: 'json';
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: args.model,
    prompt: args.prompt,
    stream: args.stream ?? false,
    think: args.think,
  };
  if (args.format === 'json') {
    body.format = 'json';
  }
  if (args.numPredict !== undefined) {
    body.options = { num_predict: args.numPredict };
  }
  return body;
}

export function ollamaEmptyResponseError(label: string, payload: OllamaGeneratePayload): Error {
  const evalCount = payload.eval_count ?? 'n/a';
  const doneReason = payload.done_reason ?? 'n/a';
  return new Error(`${label} empty response (eval_count=${evalCount}, done_reason=${doneReason})`);
}
