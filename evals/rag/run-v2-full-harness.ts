/**
 * Authoritative v2 metrics: full distractor chunks (unless RAG_EVAL_V2_FAST_CI=1).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { applyMigrations, evalVariant, seedCorpus } from './run-v2-seed-and-eval';
import { writeFinalReport } from './run-v2-report-utils';

async function main(): Promise<void> {
  const fast = process.env.RAG_EVAL_V2_FAST_CI === '1';
  console.log(`[v2-full] distractor chunks: ${fast ? 'SKIPPED (fast CI)' : 'ENABLED'}`);

  applyMigrations('stack', true);
  seedCorpus('stack');
  execSync('npx tsx evals/rag/scripts/calibrate-rejection.ts', {
    stdio: 'inherit',
    env: { ...process.env, RAG_EVAL_DATASET: 'v2' },
  });

  const { dev, test } = await evalVariant('stack');
  const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const outDir = join(process.cwd(), 'evals/rag/results');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'v2-final-dev.json'), JSON.stringify(dev, null, 2));
  writeFileSync(join(outDir, 'v2-final-test.json'), JSON.stringify(test, null, 2));

  const meta = JSON.parse(readFileSync(join(process.cwd(), 'evals/rag/corpus-meta.json'), 'utf8'));
  const report = writeFinalReport({
    label: 'v2-final (full corpus)',
    sha,
    meta,
    dev,
    test,
    distractorChunks: !fast,
  });
  writeFileSync(join(outDir, 'v2-final-report.md'), report);
  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
