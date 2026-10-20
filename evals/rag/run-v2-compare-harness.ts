/**
 * Baseline (main search) vs stack on the same v2 corpus.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyMigrations, evalVariant, seedCorpus } from './run-v2-seed-and-eval';
import { formatBaselineVsStack, saveCompareReport } from './run-v2-report-utils';

async function main(): Promise<void> {
  const fast = process.env.RAG_EVAL_V2_FAST_CI === '1';
  console.log(`[v2-compare] fast=${fast}`);

  applyMigrations('baseline', true);
  seedCorpus('baseline');

  applyMigrations('stack', true);
  seedCorpus('stack');

  execSync('npx tsx evals/rag/scripts/calibrate-rejection.ts', {
    stdio: 'inherit',
    env: { ...process.env, RAG_EVAL_DATASET: 'v2' },
  });

  const baseline = await evalVariant('baseline');
  const stack = await evalVariant('stack');
  const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const outDir = join(process.cwd(), 'evals/rag/results');
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, 'v2-baseline-dev.json'), JSON.stringify(baseline.dev, null, 2));
  writeFileSync(join(outDir, 'v2-baseline-test.json'), JSON.stringify(baseline.test, null, 2));
  writeFileSync(join(outDir, 'v2-stack-compare-dev.json'), JSON.stringify(stack.dev, null, 2));
  writeFileSync(join(outDir, 'v2-stack-compare-test.json'), JSON.stringify(stack.test, null, 2));

  const table = formatBaselineVsStack(
    { dev: baseline.dev, test: baseline.test },
    { dev: stack.dev, test: stack.test },
  );
  const report = [
    '# v2 baseline vs stack (same corpus)',
    '',
    `**Git SHA:** \`${sha}\``,
    `**Baseline:** \`evals/rag/sql/baseline.sql\` only (main / ff6fc83 search path)`,
    `**Stack:** hybrid migrations level 4`,
    `**Distractor chunks:** ${fast ? 'skipped (fast)' : 'enabled'}`,
    '',
    table,
  ].join('\n');
  saveCompareReport('v2-baseline-vs-stack.md', report);
  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
