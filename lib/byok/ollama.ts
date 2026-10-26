/** Ollama discovery helpers for BYOK. Stored base URLs are OpenAI-compatible (`…/v1`). */

const MAX_MODELS = 200;

export type OllamaModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string };

/**
 * Map an OpenAI-compatible Ollama base URL to a native API endpoint.
 * Strips a trailing `/v1`, `/api`, or `/api/tags` so proxied prefixes survive.
 */
export function ollamaApiUrl(baseUrl: string, suffix: string): string | null {
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const path = url.pathname
    .replace(/\/+$/, '')
    .replace(/\/(?:v1|api\/tags|api|tags)$/i, '');

  return `${url.origin}${path}/api/${suffix}`;
}

export function ollamaTagsUrl(baseUrl: string): string | null {
  return ollamaApiUrl(baseUrl, 'tags');
}

/**
 * Canonicalize a user-entered Ollama base URL for the OpenAI-compatible chat
 * client: strip a trailing slash (and native `/api`-style suffix) and append
 * `/v1` when missing, so `createOpenAI({ baseURL })` hits `/v1/chat/completions`.
 */
export function normalizeOllamaBaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const path = url.pathname
    .replace(/\/+$/, '')
    .replace(/\/(?:v1|api\/tags|api|tags)$/i, '');

  return `${url.origin}${path}/v1`;
}

/**
 * Models that run a chat completion. Ollama reports embedding, code-completion,
 * speech and vision-only models in the same `/api/tags` list, so drop the ones
 * that cannot answer a normal chat turn before offering them in the picker.
 */
const NON_CHAT_OLLAMA_PATTERNS: RegExp[] = [
  /embed/i,
  /(^|[^a-z])bge([^a-z]|$)/i,
  /e5(-|_|:)/i,
  /rerank/i,
  /guard/i,
  /codellama/i,
  /codegemma/i,
  /deepseek-coder/i,
  /starcoder/i,
  /\bcoder\b/i,
  /whisper/i,
  /\btts\b/i,
  /speech/i,
  /stable-diffusion/i,
  /diffusion/i,
  /\bflux\b/i,
  /sdxl/i,
  /llava/i,
  /bakllava/i,
  /moondream/i,
];

export function isChatCapableOllamaModel(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return !NON_CHAT_OLLAMA_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function readModelNamesFromTagsPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) return [];

  const names = models
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        const record = entry as { name?: unknown; model?: unknown };
        const value = record.name ?? record.model;
        return typeof value === 'string' ? value.trim() : '';
      }
      return '';
    })
    .filter((name) => name.length > 0);

  return Array.from(new Set(names)).slice(0, MAX_MODELS);
}

/** Ollama reports tagged names (`llama3.2:latest`); accept an untagged user entry too. */
export function modelExists(models: readonly string[], model: string): boolean {
  const wanted = model.trim();
  if (!wanted) return false;
  if (models.includes(wanted)) return true;
  return models.includes(`${wanted}:latest`);
}

