/**
 * Synthesize a short Norwegian RAG answer from retrieved excerpts via Ollama /generate.
 * Used by eval answer export — not the production Stemme+ chat path.
 */

import {
  buildOllamaGenerateBody,
  ollamaEmptyResponseError,
  type OllamaGeneratePayload,
  resolveOllamaThinkFlag,
} from './ollama-generate';

export const DEFAULT_ANSWER_LLM_TIMEOUT_MS = 600_000;
export const DEFAULT_ANSWER_LLM_NUM_PREDICT = 768;

const DISALLOWED_PASSTHROUGH_PREFIX = /^Basert på utdrag:\s*/i;

export type GenerateRagAnswerOptions = {
  query: string;
  excerpts: string[];
  baseUrl: string;
  model: string;
  timeoutMs: number;
  numPredict: number;
  think: boolean;
};

export function resolveAnswerLlmThink(): boolean {
  return resolveOllamaThinkFlag('ANSWER_LLM_THINK', false);
}

export function resolveAnswerLlmTimeoutMs(): number {
  const raw = process.env.ANSWER_LLM_TIMEOUT_MS;
  if (raw === undefined || raw === '') return DEFAULT_ANSWER_LLM_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ANSWER_LLM_TIMEOUT_MS;
  return n;
}

export function resolveAnswerLlmNumPredict(): number {
  const raw = process.env.ANSWER_LLM_NUM_PREDICT;
  if (raw === undefined || raw === '') return DEFAULT_ANSWER_LLM_NUM_PREDICT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ANSWER_LLM_NUM_PREDICT;
  return Math.floor(n);
}

export function resolveAnswerLlmConfig(): {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  numPredict: number;
  think: boolean;
} {
  const baseUrl = (
    process.env.ANSWER_LLM_URL ??
    process.env.OLLAMA_BASE_URL ??
    ''
  ).replace(/\/$/, '');
  const model = process.env.ANSWER_LLM_MODEL ?? '';
  if (!baseUrl) {
    throw new Error(
      'ANSWER_LLM_URL (or OLLAMA_BASE_URL) is required for answer export — excerpt passthrough is disabled.',
    );
  }
  if (!model.trim()) {
    throw new Error('ANSWER_LLM_MODEL is required for answer export — excerpt passthrough is disabled.');
  }
  return {
    baseUrl,
    model: model.trim(),
    timeoutMs: resolveAnswerLlmTimeoutMs(),
    numPredict: resolveAnswerLlmNumPredict(),
    think: resolveAnswerLlmThink(),
  };
}

export function buildRagAnswerPrompt(query: string, excerpts: string[]): string {
  const context = excerpts
    .map((text, i) => `--- Kilde ${i + 1} ---\n${text}`)
    .join('\n\n');
  return `Du er en saklig assistent for Folkets Meninger om Stortinget.

Spørsmål fra brukeren:
${query}

Kilder (kun disse — ikke bruk annen kunnskap):
${context || '(ingen kilder)'}

Skriv et kort svar på norsk bokmål (2–5 setninger) som besvarer spørsmålet.
- Bruk bare fakta som står i kildene.
- Nevn kort hvilken sak/kilde du bygger på (tittel eller henvisning fra kilden).
- Ikke kopier lange avsnitt ordrett fra kildene, og ikke lim sammen flere kildetekster.
- Hvis kildene ikke inneholder nok for å svare, si det eksplisitt i én setning (ikke gjenta irrelevant tekst).
- Ikke start med "Basert på utdrag".

Svar:`;
}

function normalizeWs(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Detects the legacy eval harness that concatenated excerpts (incl. 1200-char chop). */
export function isDisallowedExcerptPassthrough(answer: string, excerpts: string[]): boolean {
  if (!answer.trim()) return false;
  if (DISALLOWED_PASSTHROUGH_PREFIX.test(answer)) return true;
  if (excerpts.length === 0) return false;

  const body = answer.replace(DISALLOWED_PASSTHROUGH_PREFIX, '').trim();
  const joined = excerpts.join(' ').slice(0, 1200).trim();
  if (joined.length > 40 && body === joined) return true;

  const na = normalizeWs(body);
  const nj = normalizeWs(joined);
  if (nj.length > 200 && na.startsWith(nj.slice(0, Math.min(200, nj.length)))) {
    return true;
  }
  // Mid-sentence chop at 1200 chars (klever judge pattern on v2-tema-009 / 023).
  if (
    na.length >= 400 &&
    nj.startsWith(na) &&
    na.length < nj.length &&
    !/[.!?…][)"']?$/.test(body.trim())
  ) {
    return true;
  }

  let embeddedHeads = 0;
  for (const ex of excerpts) {
    const head = normalizeWs(ex).slice(0, 100);
    if (head.length >= 40 && na.includes(head)) embeddedHeads += 1;
  }
  if (embeddedHeads >= 2 && na.length >= 250) return true;

  return false;
}

export async function generateRagAnswer(opts: GenerateRagAnswerOptions): Promise<string> {
  if (opts.excerpts.length === 0) {
    return 'Fant ingen kilde i dokumentene for dette spørsmålet.';
  }

  const prompt = buildRagAnswerPrompt(opts.query, opts.excerpts);
  const res = await fetch(`${opts.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      buildOllamaGenerateBody({
        model: opts.model,
        prompt,
        think: opts.think,
        numPredict: opts.numPredict,
      }),
    ),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`answer LLM HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  const payload = (await res.json()) as OllamaGeneratePayload;
  const answer = (payload.response ?? '').trim();
  if (!answer) {
    throw ollamaEmptyResponseError('answer LLM', payload);
  }
  if (isDisallowedExcerptPassthrough(answer, opts.excerpts)) {
    throw new Error('answer LLM produced disallowed excerpt passthrough');
  }
  return answer;
}
