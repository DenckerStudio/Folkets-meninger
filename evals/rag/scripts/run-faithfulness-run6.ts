/**
 * Run 6 faithfulness bundle: retrieval R@5 (v2 test) + optional LLM answers/judge on Klever.
 *
 *   RAG_EVAL_LABEL=run6 npm run eval:rag:answers:v2   # needs ANSWER_LLM_*
 *   JUDGE_MODEL=qwen3.5:4b-q4_K_M npm run eval:rag:judge -- evals/rag/results/run6-answers.json
 *   npx tsx evals/rag/scripts/run-faithfulness-run6.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const resultsDir = join(root, 'evals/rag/results');
const answersPath = join(resultsDir, 'run6-answers.json');
const judgedSummaryPath = join(resultsDir, 'run6-answers-judged-summary.json');
const v2TestPath = join(resultsDir, 'v2-final-test.json');

type Run6Report = {
  run: 'run6';
  judgeModel: string | null;
  answerModel: string | null;
  faithfulness: number | null;
  faithfulnessCombined: number | null;
  qualityMean: number | null;
  goldFactsMeanHitRate: number | null;
  incorrectRefusalRate: number | null;
  recallAt5: number | null;
  notes: string[];
};

function runV2Eval(): number | null {
  const r = spawnSync('npx', ['tsx', 'evals/rag/run-eval-v2.ts'], {
    cwd: root,
    env: { ...process.env, RAG_EVAL_DATASET: 'v2' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    return null;
  }
  if (existsSync(v2TestPath)) {
    const j = JSON.parse(readFileSync(v2TestPath, 'utf8')) as { recallAt5?: number };
    return j.recallAt5 ?? null;
  }
  return null;
}

function main(): void {
  const report: Run6Report = {
    run: 'run6',
    judgeModel: null,
    answerModel: null,
    faithfulness: null,
    faithfulnessCombined: null,
    qualityMean: null,
    goldFactsMeanHitRate: null,
    incorrectRefusalRate: null,
    recallAt5: null,
    notes: [],
  };

  report.notes.push('run5 reference: faithfulnessMean=0.833 (gemma judge inflation); target combined ≥0.85');
  report.recallAt5 = runV2Eval();
  if (report.recallAt5 === null) {
    report.notes.push('v2 retrieval eval failed or v2-final-test.json missing — check eval DB seed');
  }

  if (existsSync(judgedSummaryPath)) {
    const s = JSON.parse(readFileSync(judgedSummaryPath, 'utf8')) as {
      judgeModel?: string;
      answerModel?: string | null;
      faithfulnessMean?: number;
      faithfulnessCombinedMean?: number;
      qualityMean?: number;
      deterministic?: {
        goldFacts?: { meanHitRate?: number };
        refusals?: { incorrectRefusalRate?: number };
      };
    };
    report.judgeModel = s.judgeModel ?? null;
    report.answerModel = s.answerModel ?? null;
    report.faithfulness = s.faithfulnessMean ?? null;
    report.faithfulnessCombined = s.faithfulnessCombinedMean ?? null;
    report.qualityMean = s.qualityMean ?? null;
    report.goldFactsMeanHitRate = s.deterministic?.goldFacts?.meanHitRate ?? null;
    report.incorrectRefusalRate = s.deterministic?.refusals?.incorrectRefusalRate ?? null;
  } else if (existsSync(answersPath)) {
    report.notes.push(`Found ${answersPath} but no judged summary — run: npm run eval:rag:judge -- ${answersPath}`);
  } else {
    report.notes.push(
      'No run6-answers.json — export on Klever with RAG_EVAL_LABEL=run6 and JUDGE_MODEL≠ANSWER_LLM_MODEL',
    );
  }

  const outPath = join(resultsDir, 'run6-faithfulness-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
}

main();
