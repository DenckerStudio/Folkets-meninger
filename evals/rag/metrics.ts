/**
 * Deterministic answer metrics (no LLM): goldFacts, refusal, source diversity.
 *
 *   npm run eval:rag:metrics -- evals/rag/results/v2-final-answers.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildDeterministicReport, type AnswerInputRow } from './lib/deterministic-metrics-report';

function main(): void {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: npx tsx evals/rag/metrics.ts <answers.json>');
  const rows = JSON.parse(readFileSync(path, 'utf8')) as AnswerInputRow[];
  const report = buildDeterministicReport(rows);
  const base = path.replace(/\.json$/, '');
  const outPath = `${base}-metrics.json`;
  const summaryPath = join(dirname(path), `${path.split('/').pop()!.replace(/\.json$/, '')}-metrics-summary.json`);
  writeFileSync(outPath, JSON.stringify(report.perRow, null, 2));
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        answersPath: path,
        rowCount: report.rowCount,
        rowsWithGenerationError: report.rowsWithGenerationError,
        goldFacts: report.goldFacts,
        refusals: report.refusals,
        sourceDiversity: report.sourceDiversity,
        targets: report.targets,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${outPath}`);
  console.log(`Wrote ${summaryPath}`);
  console.log(
    `goldFacts mean hit rate=${report.goldFacts.meanHitRate.toFixed(3)} (target ≥${report.targets.goldFactsHitRateMin})`,
  );
  console.log(
    `incorrectRefusal rate=${report.refusals.incorrectRefusalRate.toFixed(3)} (target ≤${report.targets.refusalRateMax})`,
  );
  if (process.env.RAG_EVAL_ENFORCE_TARGETS === '1' && !report.targets.goldFactsHitRateMet) {
    process.exit(1);
  }
}

main();
