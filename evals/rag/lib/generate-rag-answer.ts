/**
 * Synthesize a short Norwegian RAG answer from retrieved excerpts via Ollama /generate.
 * Used by eval answer export — not the production Stemme+ chat path.
 */

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
};

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

export function resolveAnswerLlmConfig(): { baseUrl: string; model: string; timeoutMs: number; numPredict: number } {
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
- Ikke kopier lange avsnitt ordrett fra kildene.
- Ikke start med "Basert på utdrag".

Svar:`;
}

/** Detects the legacy eval harness that concatenated excerpts (incl. 1200-char chop). */
export function isDisallowedExcerptPassthrough(answer: string, excerpts: string[]): boolean {
  if (!answer.trim()) return false;
  if (DISALLOWED_PASSTHROUGH_PREFIX.test(answer)) return true;
  if (excerpts.length === 0) return false;
  const joined = excerpts.join(' ').slice(0, 1200).trim();
  const body = answer.replace(DISALLOWED_PASSTHROUGH_PREFIX, '').trim();
  if (joined.length > 40 && body === joined) return true;
  if (joined.length > 200 && body.startsWith(joined.slice(0, Math.min(200, joined.length)))) {
    return true;
  }
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
    body: JSON.stringify({
      model: opts.model,
      prompt,
      stream: false,
      options: { num_predict: opts.numPredict },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`answer LLM HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  const payload = (await res.json()) as { response?: string };
  const answer = (payload.response ?? '').trim();
  if (!answer) {
    throw new Error('answer LLM returned empty response');
  }
  if (isDisallowedExcerptPassthrough(answer, opts.excerpts)) {
    throw new Error('answer LLM produced disallowed excerpt passthrough');
  }
  return answer;
}
