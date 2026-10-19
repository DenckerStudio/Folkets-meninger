import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TARGETS = { recallAt5: 0.85, prefixHitRate: 0.8, finnesIkkeCorrectRejectionRate: 0.8, latencyMsP95: 800 };

function main(): void {
  const env = { ...process.env, RAG_EVAL_DATASET: 'v2', PGPASSWORD: process.env.RAG_EVAL_PG_PASSWORD ?? 'rag_eval' };
  execSync('npx tsx evals/rag/scripts/apply-migrations.ts stack', {
    stdio: 'inherit',
    env: { ...env, RAG_EVAL_RESET_DB: '1', RAG_EVAL_IMPROVEMENT_LEVEL: '4' },
  });
  const fixtureExists = existsSync('evals/rag/fixtures/corpus-v2-bodies.json');
  execSync('RAG_EVAL_VARIANT=stack npx tsx evals/rag/scripts/seed-corpus.ts', {
    stdio: 'inherit',
    env: fixtureExists ? { ...env, RAG_EVAL_V2_SKIP_ISSUE_FETCH: '1' } : env,
  });
  execSync('npx tsx evals/rag/scripts/calibrate-rejection.ts', {
    stdio: 'inherit',
    env: { ...env, RAG_EVAL_DATASET: 'v2' },
  });
  execSync('npx tsx evals/rag/run-eval-v2.ts', {
    stdio: 'inherit',
    env: {
      ...env,
      RAG_EVAL_SPLIT: 'test',
      RAG_EVAL_LABEL: 'v2-test-round4-stack',
      RAG_RERANKER_ENABLED: '1',
      RAG_REJECTION_THRESHOLD: JSON.parse(
        readFileSync(join(process.cwd(), 'evals/rag/config/rejection-threshold.json'), 'utf8'),
      ).threshold,
    },
  });

  const result = JSON.parse(
    readFileSync(join(process.cwd(), 'evals/rag/results/v2-test-round4-stack.json'), 'utf8'),
  ) as Record<string, number>;
  const byCat = result.byCategory as Record<string, { n: number; rate: number }>;
  const gaps: string[] = [];
  if (result.recallAt5 < TARGETS.recallAt5) gaps.push(`sak R@5 ${(result.recallAt5 * 100).toFixed(1)}%`);
  if (result.prefixHitRate < TARGETS.prefixHitRate) gaps.push(`prefix ${(result.prefixHitRate * 100).toFixed(1)}%`);
  if (result.finnesIkkeCorrectRejectionRate < TARGETS.finnesIkkeCorrectRejectionRate) {
    gaps.push(`reject ${(result.finnesIkkeCorrectRejectionRate * 100).toFixed(1)}%`);
  }
  if (result.latencyMsP95 > TARGETS.latencyMsP95) gaps.push(`p95 ${result.latencyMsP95}ms`);
  if ((byCat.horinger?.n ?? 0) === 0) gaps.push('horinger n=0 (all excluded from seed)');
  if ((byCat.voteringer_parti?.rate ?? 0) < 0.8) {
    gaps.push(`voteringer_parti ${((byCat.voteringer_parti?.rate ?? 0) * 100).toFixed(1)}%`);
  }

  const meta = JSON.parse(readFileSync(join(process.cwd(), 'evals/rag/corpus-meta.json'), 'utf8')) as {
    issues?: number;
    hearings?: number;
    excludedHearings?: unknown[];
    chunks?: number;
  };
  const report = [
    '# v2 held-out test report (round4 stack)',
    '',
    `Seed: ${meta.issues ?? '?'} issues, ${meta.hearings ?? '?'} hearings seeded, ${meta.excludedHearings?.length ?? 0} hearings excluded (not faked).`,
    '',
    `Targets met: ${gaps.length === 0 ? 'yes' : `no (${gaps.join(', ')})`}`,
    '',
    'Caveats: `tema` labels may be weak; `finnes_ikke` GT is title-only (see finnesIkkeFullTextHits in JSON).',
    '',
    readFileSync(join(process.cwd(), 'evals/rag/results/v2-test-round4-stack.md'), 'utf8'),
  ].join('\n');
  writeFileSync(join(process.cwd(), 'evals/rag/results/v2-test-report.md'), report);
  console.log(report);
}

main();
