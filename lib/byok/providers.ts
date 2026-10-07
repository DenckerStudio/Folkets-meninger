export const LLM_PROVIDERS = [
  'google',
  'openai',
  'grok',
  'ollama',
  'anthropic',
  'openai_compatible',
  'ai_gateway',
] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

/** First-class Stemme+ BYOK providers shown in the main select. */
export const PRIMARY_LLM_PROVIDERS = ['google', 'openai', 'grok', 'ollama'] as const;

/** Legacy / niche providers under «Annet». */
export const OTHER_LLM_PROVIDERS = ['anthropic', 'openai_compatible', 'ai_gateway'] as const;

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  google: 'gemini-3.8-flash',
  openai: 'gpt-4o-mini',
  grok: 'grok-4.7',
  ollama: 'llama3.2',
  anthropic: 'claude-sonnet-4-5',
  openai_compatible: 'gpt-4o-mini',
  ai_gateway: 'openai/gpt-4o-mini',
};

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  google: 'Google (Gemini)',
  openai: 'OpenAI',
  grok: 'Grok (xAI)',
  ollama: 'Ollama',
  anthropic: 'Anthropic',
  openai_compatible: 'OpenAI-kompatibel',
  ai_gateway: 'Vercel AI Gateway',
};

/** Stored when Ollama is saved without a real API key (local servers often need none). */
export const OLLAMA_PLACEHOLDER_API_KEY = 'ollama';

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

export function providerNeedsApiKey(provider: LlmProvider): boolean {
  return provider !== 'ollama';
}

export function normalizeModel(provider: LlmProvider, model: unknown): string {
  if (typeof model === 'string' && model.trim()) {
    return model.trim().slice(0, MAX_MODEL_LENGTH);
  }
  return DEFAULT_MODELS[provider];
}

export function normalizeBaseUrl(provider: LlmProvider, value: unknown): string | null {
  if (provider !== 'openai_compatible' && provider !== 'ollama') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (provider === 'ollama') {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    } else if (url.protocol !== 'https:') {
      return null;
    }
    return url.toString().slice(0, MAX_BASE_URL_LENGTH);
  } catch {
    return null;
  }
}

export function providerNeedsBaseUrl(provider: LlmProvider): boolean {
  return provider === 'openai_compatible' || provider === 'ollama';
}
