/**
 * Faithfulness judge + deterministic answer metrics over saved answer JSON.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  GOLD_FACTS_HIT_TARGET,
  quantizeScore025,
  REFUSAL_RATE_TARGET,
  scoreDeterministicRow,
  summarizeGoldFacts,
  summarizeRefusals,
  summarizeSourceDiversity,
  type PerRowDeterministicMetrics,
} from './lib/answer-metrics';
import { assertJudgeDiffersFromAnswerModel, resolveJudgeModel } from './lib/judge-model-guard';
import {
  buildOllamaGenerateBody,
  ollamaEmptyResponseError,
  type OllamaGeneratePayload,
  resolveOllamaThinkFlag,
} from './lib/ollama-generate';

const JUDGE_URL = (process.env.JUDGE_URL ?? 'http://192.168.50.154:11434').replace(/\/$/, '');
const JUDGE_MODEL = resolveJudgeModel();
const DEFAULT_JUDGE_TIMEOUT_MS = 900_000;

function resolveJudgeTimeoutMs(): number {
  const raw = process.env.JUDGE_TIMEOUT_MS;
  if (raw === undefined || raw === '') return DEFAULT_JUDGE_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_JUDGE_TIMEOUT_MS;
  return n;
}

const JUDGE_TIMEOUT_MS = resolveJudgeTimeoutMs();
const JUDGE_THINK = resolveOllamaThinkFlag('JUDGE_THINK', false);

type AnswerRow = {
  id: string;
  category?: string;
  query: string;
  answer: string;
  excerpts: string[];
  goldFacts: string[];
  generationError?: string;
  answerModel?: string;
  retrievalSourceKeys?: string[];
};

type JudgedRow = {
  id: string;
  faithfulness: number;
  quality: number;
  note: string;
  faithfulnessRaw?: number;
  qualityRaw?: number;
  deterministic: PerRowDeterministicMetrics;
  incorrectRefusalOverride: boolean;
};

function buildJudgePrompt(row: AnswerRow): string {
  return `Du er en uavhengig, streng evaluator for Stortinget-RAG (ikke svarmodellen).

Spørsmål: ${row.query}
Gull-fakta (svaret bør dekke disse når de finnes i kildene): ${row.goldFacts.join(', ') || '(ingen)'}
Utdrag fra retrieval:
${row.excerpts.join('\n---\n')}
Kandidatsvar:
${row.answer}

Rubric (bruk KUN disse nivåene: 0, 0.25, 0.5, 0.75, 1):
- faithfulness: støttes alle påstander i svaret av utdragene? Trekk ned for hallusinasjoner eller påstander uten kilde.
- quality: besvarer svaret spørsmålet kort og tydelig på norsk? Trekk ned hvis det bare gjentar utdrag, mangler gull-fakta, eller nekter å svare når kildene faktisk inneholder relevant info.

Straff eksplisitt:
- quality maks 0.25 hvis gull-fakta mangler i svaret men finnes i utdragene
- quality maks 0.25 hvis svaret sier at kildene ikke inneholder info uten å prøve å svare
- faithfulness maks 0.5 hvis viktige påstander ikke kan spores til utdrag

Gi KUN JSON (ingen markdown):
{"faithfulness":0|0.25|0.5|0.75|1,"quality":0|0.25|0.5|0.75|1,"justification":"2-4 setninger som nevner gull-fakta og kilder"}`;
}

async function judgeRow(row: AnswerRow, deterministic: PerRowDeterministicMetrics): Promise<JudgedRow> {
  const res = await fetch(`${JUDGE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      buildOllamaGenerateBody({ model: JUDGE_MODEL, prompt: buildJudgePrompt(row), think: JUDGE_THINK }),
    ),
    signal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`judge HTTP ${res.status}`);
  const payload = (await res.json()) as OllamaGeneratePayload;
  const text = payload.response ?? '';
  if (!text.trim()) {
    throw ollamaEmptyResponseError('judge', payload);
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      id: row.id,
      faithfulness: 0,
      quality: 0,
      note: 'parse_fail',
      deterministic,
      incorrectRefusalOverride: false,
    };
  }
  const parsed = JSON.parse(match[0]) as {
    faithfulness: number;
    quality: number;
    justification?: string;
    note?: string;
  };
  let faithRaw = Number(parsed.faithfulness);
  let qualRaw = Number(parsed.quality);
  if (!Number.isFinite(faithRaw)) faithRaw = 0;
  if (!Number.isFinite(qualRaw)) qualRaw = 0;

  let incorrectRefusalOverride = false;
  if (deterministic.incorrectRefusal) {
    qualRaw = 0;
    incorrectRefusalOverride = true;
  }
  if (row.goldFacts.length > 0 && !deterministic.goldFactsHit && qualRaw > 0.25) {
    qualRaw = 0.25;
  }

  const faithfulness = quantizeScore025(faithRaw);
  const quality = quantizeScore025(qualRaw);
  const note = (parsed.justification ?? parsed.note ?? '').trim() || 'no_justification';

  return {
    id: row.id,
    faithfulness,
    quality,
    faithfulnessRaw: faithRaw,
    qualityRaw: qualRaw,
    note,
    deterministic,
    incorrectRefusalOverride,
  };
}

function summarizeLlm(rows: JudgedRow[]): Record<string, number> {
  const n = rows.length || 1;
  const faith = rows.reduce((s, r) => s + r.faithfulness, 0) / n;
  const qual = rows.reduce((s, r) => s + r.quality, 0) / n;
  const pass = rows.filter((r) => r.faithfulness >= 0.7).length / n;
  const maxBoth = rows.filter((r) => r.faithfulness === 1 && r.quality === 1).length / n;
  return {
    count: rows.length,
    faithfulnessMean: faith,
    qualityMean: qual,
    faithfulnessPassRate: pass,
    maxScoreFraction: maxBoth,
  };
}

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: npx tsx evals/rag/judge.ts <answers.json>');

  const rows = JSON.parse(readFileSync(path, 'utf8')) as AnswerRow[];
  const answerModel = rows.find((r) => r.answerModel)?.answerModel;
  assertJudgeDiffersFromAnswerModel({ judgeModel: JUDGE_MODEL, answerModel });

  const categoryById = new Map(rows.map((r) => [r.id, r.category ?? '']));
  const deterministicRows = rows.map((r) =>
    scoreDeterministicRow({
      id: r.id,
      category: r.category,
      query: r.query,
      answer: r.answer,
      excerpts: r.excerpts,
      goldFacts: r.goldFacts,
    }),
  );

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
    const det = deterministicRows.find((d) => d.id === row.id)!;
    process.stdout.write(`[judge] ${row.id}…\n`);
    out.push(await judgeRow(row, det));
  }
  if (skipped.length > 0) {
    throw new Error(
      `Answers file has ${skipped.length} row(s) with generation errors or empty answers — fix export first:\n${skipped.join('\n')}`,
    );
  }

  const goldSummary = summarizeGoldFacts(deterministicRows);
  const refusalSummary = summarizeRefusals(deterministicRows);
  const diversity = summarizeSourceDiversity(deterministicRows, categoryById);
  const llmStats = summarizeLlm(out);

  let calibrationWarning: string | null = null;
  if (llmStats.maxScoreFraction > 0.9) {
    calibrationWarning =
      `LLM judge gave faithfulness=1 and quality=1 on ${(llmStats.maxScoreFraction * 100).toFixed(0)}% of rows (>90%). ` +
      'Scores are likely inflated — prefer deterministic goldFacts/refusal metrics and a judge model different from the answer model.';
  }

  const targets = {
    goldFactsHitRateMin: GOLD_FACTS_HIT_TARGET,
    goldFactsHitRateMet: goldSummary.meanHitRate >= GOLD_FACTS_HIT_TARGET,
    refusalRateMax: REFUSAL_RATE_TARGET,
    refusalRateMet: refusalSummary.incorrectRefusalRate <= REFUSAL_RATE_TARGET,
    faithfulnessMin: 0.85,
    faithfulnessMet: llmStats.faithfulnessMean >= 0.85,
    qualityMin: 0.7,
    qualityMet: llmStats.qualityMean >= 0.7,
  };

  const outPath = path.replace(/\.json$/, '.judged.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  const summaryPath = join(dirname(path), path.split('/').pop()!.replace(/\.json$/, '-judged-summary.json'));
  const summary = {
    judgeModel: JUDGE_MODEL,
    answerModel: answerModel ?? null,
    judgeUrl: JUDGE_URL,
    judgeTimeoutMs: JUDGE_TIMEOUT_MS,
    judgeThink: JUDGE_THINK,
    deterministic: {
      goldFacts: goldSummary,
      refusals: refusalSummary,
      sourceDiversity: diversity,
    },
    targets,
    calibrationWarning,
    ...llmStats,
    rows: out,
  };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(`Wrote ${summaryPath}`);
  console.log(
    `Deterministic goldFacts mean hit rate=${goldSummary.meanHitRate.toFixed(3)} (target ≥${GOLD_FACTS_HIT_TARGET})`,
  );
  console.log(
    `Incorrect refusal rate=${refusalSummary.incorrectRefusalRate.toFixed(3)} on rows with gold (target ≤${REFUSAL_RATE_TARGET})`,
  );
  console.log(
    `LLM faithfulness mean=${llmStats.faithfulnessMean.toFixed(3)} quality mean=${llmStats.qualityMean.toFixed(3)}`,
  );
  if (calibrationWarning) console.warn(`CALIBRATION: ${calibrationWarning}`);
  if (process.env.RAG_EVAL_ENFORCE_TARGETS === '1') {
    const failed = Object.entries(targets)
      .filter(([k, v]) => k.endsWith('Met') && v === false)
      .map(([k]) => k);
    if (failed.length > 0) {
      throw new Error(`Targets not met: ${failed.join(', ')}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
