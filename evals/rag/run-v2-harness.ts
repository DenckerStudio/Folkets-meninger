/** CI-fast v2 harness (RAG_EVAL_V2_FAST_CI=1 skips distractor chunk embeds). */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyMigrations, evalVariant, seedCorpus } from './run-v2-seed-and-eval';
import { formatSideBySide, writeFinalReport } from './run-v2-report-utils';

async function main(): Promise<void> {
  process.env.RAG_EVAL_V2_FAST_CI = process.env.RAG_EVAL_V2_FAST_CI ?? '1';
  applyMigrations('stack', true);
  seedCorpus('stack');
  execSync('npx tsx evals/rag/scripts/calibrate-rejection.ts', {
    stdio: 'inherit',
    env: { ...process.env, RAG_EVAL_DATASET: 'v2' },
  });

  const results = await evalVariant('stack');
  const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const outDir = join(process.cwd(), 'evals/rag/results');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'v2-dev-round4-stack.json'), JSON.stringify(results.dev, null, 2));
  writeFileSync(join(outDir, 'v2-test-round4-stack.json'), JSON.stringify(results.test, null, 2));
  const sideBySide = formatSideBySide(results.dev, results.test);
  writeFileSync(join(outDir, 'v2-dev-test-round4-stack.md'), `# RAG eval v2 dev vs test (CI fast)\n\n${sideBySide}\n`);

  const meta = JSON.parse(readFileSync(join(process.cwd(), 'evals/rag/corpus-meta.json'), 'utf8'));
  const report = writeFinalReport({
    label: 'v2 CI fast harness',
    sha,
    meta,
    dev: results.dev,
    test: results.test,
    distractorChunks: false,
  });
  writeFileSync(join(outDir, 'v2-test-report.md'), report);
  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
