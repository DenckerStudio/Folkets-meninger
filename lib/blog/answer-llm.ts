import {
  buildOllamaGenerateBody,
  ollamaEmptyResponseError,
  resolveOllamaGenerateText,
  resolveOllamaThinkFlag,
  type OllamaGeneratePayload,
} from '@/lib/blog/ollama-generate';

const DEFAULT_TIMEOUT_MS = 600_000;
const DEFAULT_NUM_PREDICT = 1_024;

export function isAnswerLlmConfigured(): boolean {
  const base = (process.env.ANSWER_LLM_URL ?? process.env.OLLAMA_BASE_URL ?? '').trim();
  const model = (process.env.ANSWER_LLM_MODEL ?? '').trim();
  return Boolean(base && model);
}

export function resolveAnswerLlmConfig(): {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  numPredict: number;
  think: boolean;
} | null {
  if (!isAnswerLlmConfigured()) return null;
  const baseUrl = (process.env.ANSWER_LLM_URL ?? process.env.OLLAMA_BASE_URL ?? '').replace(
    /\/$/,
    '',
  );
  const model = process.env.ANSWER_LLM_MODEL!.trim();

  const timeoutRaw = process.env.ANSWER_LLM_TIMEOUT_MS;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (timeoutRaw) {
    const n = Number(timeoutRaw);
    if (Number.isFinite(n) && n > 0) timeoutMs = n;
  }

  const predictRaw = process.env.ANSWER_LLM_NUM_PREDICT;
  let numPredict = DEFAULT_NUM_PREDICT;
  if (predictRaw) {
    const n = Number(predictRaw);
    if (Number.isFinite(n) && n > 0) numPredict = Math.floor(n);
  }

  return {
    baseUrl,
    model,
    timeoutMs,
    numPredict,
    think: resolveOllamaThinkFlag('ANSWER_LLM_THINK', false),
  };
}

export async function generateWithAnswerLlm(prompt: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const config = resolveAnswerLlmConfig();
  if (!config) {
    throw new Error('ANSWER_LLM_URL og ANSWER_LLM_MODEL må være satt');
  }

  const res = await fetchImpl(`${config.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      buildOllamaGenerateBody({
        model: config.model,
        prompt,
        think: config.think,
        numPredict: config.numPredict,
      }),
    ),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ANSWER_LLM HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  const payload = (await res.json()) as OllamaGeneratePayload;
  const text = resolveOllamaGenerateText(payload);
  if (!text) {
    throw ollamaEmptyResponseError('ANSWER_LLM', payload);
  }
  return text.trim();
}