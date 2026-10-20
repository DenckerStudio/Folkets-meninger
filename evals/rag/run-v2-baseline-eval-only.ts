/**
 * Eval baseline DB only (expects corpus already seeded). Stack metrics read from v2-final JSON.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { evalVariant } from './run-v2-seed-and-eval';
import { formatBaselineVsStack, saveCompareReport, type EvalJson } from './run-v2-report-utils';

async function main(): Promise<void> {
  const baseline = await evalVariant('baseline');
  const stackDev = JSON.parse(
    readFileSync(join(process.cwd(), 'evals/rag/results/v2-final-dev.json'), 'utf8'),
  ) as EvalJson;
  const stackTest = JSON.parse(
    readFileSync(join(process.cwd(), 'evals/rag/results/v2-final-test.json'), 'utf8'),
  ) as EvalJson;
  const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const table = formatBaselineVsStack(
    { dev: baseline.dev, test: baseline.test },
    { dev: stackDev, test: stackTest },
  );
  const report = [
    '# v2 baseline vs stack (same corpus)',
    '',
    `**Git SHA:** \`${sha}\``,
    '**Baseline:** `evals/rag/sql/baseline.sql` (main search path, no RAG migrations)',
    '**Stack:** v2-final full run (level-5 migrations, distractor chunks enabled)',
    '**Corpus:** 2465 issues, 3114 stack chunks (see `v2-final-report.md`)',
    '',
    table,
  ].join('\n');
  saveCompareReport('v2-baseline-vs-stack.md', report);
  writeFileSync(join(process.cwd(), 'evals/rag/results/v2-baseline-dev.json'), JSON.stringify(baseline.dev, null, 2));
  writeFileSync(join(process.cwd(), 'evals/rag/results/v2-baseline-test.json'), JSON.stringify(baseline.test, null, 2));
  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
