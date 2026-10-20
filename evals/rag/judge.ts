/**
 * Faithfulness judge (LLM) + optional merge with deterministic metrics summary.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildDeterministicReport, type AnswerInputRow } from './lib/deterministic-metrics-report';
import { assertJudgeDiffersFromAnswerModel, resolveJudgeModel } from './lib/judge-model-guard';
import {
  buildJudgeRetryPrompt,
  parseJudgeScoresJson,
} from './lib/judge-parse';
import {
  applyParsedJudgeScores,
  isResumeCompleteRow,
  summarizeLlmJudged,
  type JudgedRowOutput,
} from './lib/judge-scoring';
import {
  buildJudgeGenerateBody,
  cascadeJudgeOllamaText,
  resolveJudgeMaxErrorRate,
} from './lib/judge-ollama';
import {
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

type AnswerRow = AnswerInputRow & {
  retrievalSourceKeys?: string[];
};

function parseCliArgs(argv: string[]): { answersPath: string; resume: boolean } {
  const resume = argv.includes('--resume');
  const path = argv.find((a) => !a.startsWith('--'));
  if (!path) throw new Error('Usage: npx tsx evals/rag/judge.ts [--resume] <answers.json>');
  return { answersPath: path, resume };
}

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

Returner KUN gyldig JSON med nøklene faithfulness, quality, justification (ingen markdown).`;
}

async function callJudgeOllama(
  prompt: string,
  opts: { formatJson: boolean; think: boolean },
): Promise<OllamaGeneratePayload> {
  const res = await fetch(`${JUDGE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      buildJudgeGenerateBody({
        model: JUDGE_MODEL,
        prompt,
        formatJson: opts.formatJson,
        think: opts.think,
      }),
    ),
    signal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`judge HTTP ${res.status}`);
  return (await res.json()) as OllamaGeneratePayload;
}

async function fetchJudgeText(prompt: string): Promise<string> {
  const { text } = await cascadeJudgeOllamaText(({ formatJson, think }) =>
    callJudgeOllama(prompt, { formatJson, think }),
  );
  return text;
}

async function judgeRowLlm(row: AnswerRow, deterministic: JudgedRowOutput['deterministic']): Promise<JudgedRowOutput> {
  let text = await fetchJudgeText(buildJudgePrompt(row));
  let parsed = parseJudgeScoresJson(text);
  if (!parsed) {
    text = await fetchJudgeText(buildJudgeRetryPrompt({ query: row.query, priorResponse: text }));
    parsed = parseJudgeScoresJson(text);
  }
  if (!parsed) {
    return {
      id: row.id,
      deterministic,
      judgeError: `judge JSON parse failed after retry (response length ${text.length})`,
    };
  }
  return applyParsedJudgeScores(row, deterministic, parsed);
}

function loadResumeMap(judgedPath: string): Map<string, JudgedRowOutput> {
  if (!existsSync(judgedPath)) return new Map();
  const prev = JSON.parse(readFileSync(judgedPath, 'utf8')) as JudgedRowOutput[];
  const map = new Map<string, JudgedRowOutput>();
  for (const row of prev) {
    if (row.id) map.set(row.id, row);
  }
  return map;
}

async function main(): Promise<void> {
  const { answersPath, resume } = parseCliArgs(process.argv.slice(2));
  const rows = JSON.parse(readFileSync(answersPath, 'utf8')) as AnswerRow[];
  const answerModel = rows.find((r) => r.answerModel)?.answerModel;
  assertJudgeDiffersFromAnswerModel({ judgeModel: JUDGE_MODEL, answerModel });

  const deterministicReport = buildDeterministicReport(rows);
  const detById = new Map(deterministicReport.perRow.map((d) => [d.id, d]));

  const outPath = answersPath.replace(/\.json$/, '.judged.json');
  const resumeMap = resume ? loadResumeMap(outPath) : new Map<string, JudgedRowOutput>();

  const out: JudgedRowOutput[] = [];
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
    const det = detById.get(row.id);
    if (!det) {
      skipped.push(`${row.id}: missing deterministic row`);
      continue;
    }

    const cached = resumeMap.get(row.id);
    if (resume && cached && isResumeCompleteRow(cached)) {
      process.stdout.write(`[judge] ${row.id} (resume skip)\n`);
      out.push({ ...cached, deterministic: det });
      continue;
    }

    process.stdout.write(`[judge] ${row.id}…\n`);
    try {
      out.push(await judgeRowLlm(row, det));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[judge] ${row.id} ERROR: ${message}\n`);
      out.push({ id: row.id, deterministic: det, judgeError: message });
    }
  }

  if (skipped.length > 0) {
    throw new Error(
      `Answers file has ${skipped.length} row(s) with generation errors or empty answers — fix export first:\n${skipped.join('\n')}`,
    );
  }

  const llmStats = summarizeLlmJudged(out);

  let calibrationWarning: string | null = null;
  if (llmStats.count > 0 && llmStats.maxScoreFraction > 0.9) {
    calibrationWarning =
      `LLM judge gave faithfulness=1 and quality=1 on ${(llmStats.maxScoreFraction * 100).toFixed(0)}% of judged rows (>90%). ` +
      'Scores are likely inflated — prefer deterministic metrics and a judge model different from the answer model.';
  }

  const targets = {
    ...deterministicReport.targets,
    faithfulnessMin: 0.85,
    faithfulnessMet: llmStats.count > 0 && llmStats.faithfulnessMean >= 0.85,
    qualityMin: 0.7,
    qualityMet: llmStats.count > 0 && llmStats.qualityMean >= 0.7,
  };

  const summaryPath = join(
    dirname(answersPath),
    answersPath.split('/').pop()!.replace(/\.json$/, '-judged-summary.json'),
  );
  const judgeMaxErrorRate = resolveJudgeMaxErrorRate();

  const summary = {
    judgeModel: JUDGE_MODEL,
    answerModel: answerModel ?? null,
    judgeUrl: JUDGE_URL,
    judgeTimeoutMs: JUDGE_TIMEOUT_MS,
    judgeThink: JUDGE_THINK,
    judgeMaxErrorRate,
    resume,
    deterministic: {
      goldFacts: deterministicReport.goldFacts,
      refusals: deterministicReport.refusals,
      sourceDiversity: deterministicReport.sourceDiversity,
      targets: deterministicReport.targets,
    },
    targets,
    calibrationWarning,
    ...llmStats,
    rows: out,
  };
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(`Wrote ${summaryPath}`);
  console.log(
    `Deterministic goldFacts mean hit rate=${deterministicReport.goldFacts.meanHitRate.toFixed(3)} (run npm run eval:rag:metrics for details)`,
  );
  console.log(
    `LLM judged=${llmStats.count} errors=${llmStats.judgeErrorCount} (${(llmStats.judgeErrorRate * 100).toFixed(1)}%) faithfulness=${llmStats.faithfulnessMean.toFixed(3)} quality=${llmStats.qualityMean.toFixed(3)}`,
  );
  if (calibrationWarning) console.warn(`CALIBRATION: ${calibrationWarning}`);
  if (llmStats.judgeErrorRate > judgeMaxErrorRate) {
    throw new Error(
      `Judge error rate ${(llmStats.judgeErrorRate * 100).toFixed(1)}% exceeds JUDGE_MAX_ERROR_RATE=${judgeMaxErrorRate} (${llmStats.judgeErrorCount}/${rows.length} rows)`,
    );
  }
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
