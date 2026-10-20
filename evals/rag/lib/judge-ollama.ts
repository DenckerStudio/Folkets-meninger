import {
  buildOllamaGenerateBody,
  ollamaEmptyResponseError,
  resolveOllamaGenerateText,
  type OllamaGeneratePayload,
} from './ollama-generate';

export type JudgeOllamaCall = (opts: { formatJson: boolean; think: boolean }) => Promise<OllamaGeneratePayload>;

/**
 * Judge generate cascade: format=json + think=false, then plain text if empty
 * (some models put JSON only in `thinking` when format=json).
 */
export async function cascadeJudgeOllamaText(call: JudgeOllamaCall): Promise<{
  text: string;
  payload: OllamaGeneratePayload;
}> {
  let payload = await call({ formatJson: true, think: false });
  let text = resolveOllamaGenerateText(payload);
  if (!text) {
    payload = await call({ formatJson: false, think: false });
    text = resolveOllamaGenerateText(payload);
  }
  if (!text) {
    throw ollamaEmptyResponseError('judge', payload);
  }
  return { text, payload };
}

export function resolveJudgeMaxErrorRate(): number {
  const raw = process.env.JUDGE_MAX_ERROR_RATE;
  if (raw === undefined || raw === '') return 0.5;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return 0.5;
  return n;
}

export function buildJudgeGenerateBody(args: {
  model: string;
  prompt: string;
  formatJson: boolean;
  think: boolean;
}): Record<string, unknown> {
  return buildOllamaGenerateBody({
    model: args.model,
    prompt: args.prompt,
    think: args.think,
    format: args.formatJson ? 'json' : undefined,
  });
}
