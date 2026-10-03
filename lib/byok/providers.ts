export const LLM_PROVIDERS = [
  'openai',
  'anthropic',
  'openai_compatible',
  'ai_gateway',
] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5',
  openai_compatible: 'gpt-4o-mini',
  ai_gateway: 'openai/gpt-4o-mini',
};

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openai_compatible: 'OpenAI-kompatibel',
  ai_gateway: 'Vercel AI Gateway',
};

const MAX_KEY_LENGTH = 512;
const MIN_KEY_LENGTH = 20;
const MAX_MODEL_LENGTH = 80;
const MAX_BASE_URL_LENGTH = 200;

export function isLlmProvider(value: unknown): value is LlmProvider {
  return typeof value === 'string' && (LLM_PROVIDERS as readonly string[]).includes(value);
}

export function looksLikeApiKey(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= MIN_KEY_LENGTH && trimmed.length <= MAX_KEY_LENGTH && !/\s/.test(trimmed);
}

export function normalizeModel(provider: LlmProvider, model: unknown): string {
  if (typeof model === 'string' && model.trim()) {
    return model.trim().slice(0, MAX_MODEL_LENGTH);
  }
  return DEFAULT_MODELS[provider];
}

export function normalizeBaseUrl(provider: LlmProvider, value: unknown): string | null {
  if (provider !== 'openai_compatible') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    return url.toString().slice(0, MAX_BASE_URL_LENGTH);
  } catch {
    return null;
  }
}

export function providerNeedsBaseUrl(provider: LlmProvider): boolean {
  return provider === 'openai_compatible';
}
