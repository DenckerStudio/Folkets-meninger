/**
 * Standalone LLM judge over saved answer JSON (run after eval on LAN Ollama).
 *
 *   JUDGE_URL=http://192.168.50.154:11434 JUDGE_MODEL=gemma4:26b \
 *     npx tsx evals/rag/judge.ts evals/rag/results/stack-answers.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const JUDGE_URL = (process.env.JUDGE_URL ?? 'http://192.168.50.154:11434').replace(/\/$/, '');
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'gemma4:26b';

type AnswerRow = {
  id: string;
  query: string;
  answer: string;
  excerpts: string[];
  goldFacts: string[];
};

async function judgeRow(row: AnswerRow): Promise<{ faithfulness: number; quality: number; note: string }> {
  const prompt = `Du er en streng fakta-sjekker for Stortinget-RAG.
Spørsmål: ${row.query}
Gull-fakta (skal støttes av utdrag): ${row.goldFacts.join(', ') || '(ingen)'}
Utdrag:\n${row.excerpts.join('\n---\n')}
Svar:\n${row.answer}

Gi JSON: {"faithfulness":0-1,"quality":0-1,"note":"kort"}`;

  const res = await fetch(`${JUDGE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: JUDGE_MODEL, prompt, stream: false }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`judge HTTP ${res.status}`);
  const payload = (await res.json()) as { response?: string };
  const text = payload.response ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { faithfulness: 0, quality: 0, note: 'parse_fail' };
  return JSON.parse(match[0]) as { faithfulness: number; quality: number; note: string };
}

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: npx tsx evals/rag/judge.ts <answers.json>');
  const rows = JSON.parse(readFileSync(path, 'utf8')) as AnswerRow[];
  const out = [];
  for (const row of rows) {
    out.push({ id: row.id, ...(await judgeRow(row)) });
  }
  const outPath = path.replace(/\.json$/, '.judged.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
