/**
 * Faithfulness judge over saved answer JSON (LAN Ollama gemma4:26b).
 *
 * Generate answers (repo root):
 *   RAG_EVAL_LABEL=round3-rerank-reject npm run eval:rag:answers
 *
 * Run judge (gemma4:26b can take 75s+ per row — raise timeout if needed):
 *   JUDGE_URL=http://192.168.50.154:11434 JUDGE_MODEL=gemma4:26b JUDGE_TIMEOUT_MS=900000 \
 *     npm run eval:rag:judge -- evals/rag/results/round3-rerank-reject-answers.json
 *
 * Output: same path with `.judged.json` suffix + `*-judged-summary.json` alongside.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const JUDGE_URL = (process.env.JUDGE_URL ?? 'http://192.168.50.154:11434').replace(/\/$/, '');
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'gemma4:26b';
const DEFAULT_JUDGE_TIMEOUT_MS = 900_000;

function resolveJudgeTimeoutMs(): number {
  const raw = process.env.JUDGE_TIMEOUT_MS;
  if (raw === undefined || raw === '') return DEFAULT_JUDGE_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_JUDGE_TIMEOUT_MS;
  return n;
}

const JUDGE_TIMEOUT_MS = resolveJudgeTimeoutMs();

type AnswerRow = {
  id: string;
  query: string;
  answer: string;
  excerpts: string[];
  goldFacts: string[];
  generationError?: string;
};

type JudgedRow = {
  id: string;
  faithfulness: number;
  quality: number;
  note: string;
};

async function judgeRow(row: AnswerRow): Promise<JudgedRow> {
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
    signal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`judge HTTP ${res.status}`);
  const payload = (await res.json()) as { response?: string };
  const text = payload.response ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { id: row.id, faithfulness: 0, quality: 0, note: 'parse_fail' };
  const parsed = JSON.parse(match[0]) as { faithfulness: number; quality: number; note: string };
  return { id: row.id, faithfulness: parsed.faithfulness, quality: parsed.quality, note: parsed.note };
}

function summarize(rows: JudgedRow[]): Record<string, number> {
  const n = rows.length || 1;
  const faith = rows.reduce((s, r) => s + r.faithfulness, 0) / n;
  const qual = rows.reduce((s, r) => s + r.quality, 0) / n;
  const pass = rows.filter((r) => r.faithfulness >= 0.7).length / n;
  return {
    count: rows.length,
    faithfulnessMean: faith,
    qualityMean: qual,
    faithfulnessPassRate: pass,
  };
}

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: npx tsx evals/rag/judge.ts <answers.json>');
  const rows = JSON.parse(readFileSync(path, 'utf8')) as AnswerRow[];
  const out: JudgedRow[] = [];
  const skipped: string[] = [];
  for (const row of rows) {
    if (row.generationError) {
      skipped.push(`${row.id}: ${row.generationError}`);
      continue;
    }
    if (!row.answer?.trim()) {
      skipped.push(`${row.id}: empty answer`);
      continue;
    }
    process.stdout.write(`[judge] ${row.id}…\n`);
    out.push(await judgeRow(row));
  }
  if (skipped.length > 0) {
    throw new Error(
      `Answers file has ${skipped.length} row(s) with generation errors or empty answers — fix export first:\n${skipped.join('\n')}`,
    );
  }
  const outPath = path.replace(/\.json$/, '.judged.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  const summaryPath = join(dirname(path), path.split('/').pop()!.replace(/\.json$/, '-judged-summary.json'));
  const stats = summarize(out);
  const summary = { model: JUDGE_MODEL, judgeUrl: JUDGE_URL, judgeTimeoutMs: JUDGE_TIMEOUT_MS, ...stats, rows: out };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(`Wrote ${summaryPath}`);
  console.log(
    `Summary: faithfulness mean=${stats.faithfulnessMean.toFixed(3)} pass@${'≥'}0.7=${(stats.faithfulnessPassRate * 100).toFixed(1)}%`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
