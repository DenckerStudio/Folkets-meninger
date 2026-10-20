/**
 * Shared v2 corpus seed + eval (used by harness, full run, baseline comparison).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runEvalV2 } from './run-eval-v2';

export type V2EvalResult = Awaited<ReturnType<typeof runEvalV2>>;

export function seedEnv(fixtureExists: boolean, variant: 'baseline' | 'stack'): Record<string, string> {
  const fast = process.env.RAG_EVAL_V2_FAST_CI === '1';
  return {
    RAG_EVAL_DATASET: 'v2',
    RAG_EVAL_VARIANT: variant,
    ...(fixtureExists ? { RAG_EVAL_V2_SKIP_ISSUE_FETCH: '1' } : {}),
    RAG_EVAL_V2_VOTERING_ALL_CORE: '1',
    ...(fast ? { RAG_EVAL_V2_SKIP_DISTRACTOR_CHUNKS: '1' } : {}),
  };
}

export function applyMigrations(variant: 'baseline' | 'stack', reset: boolean): void {
  const env = {
    ...process.env,
    PGPASSWORD: process.env.RAG_EVAL_PG_PASSWORD ?? 'rag_eval',
    RAG_EVAL_VARIANT: variant,
    ...(reset ? { RAG_EVAL_RESET_DB: '1' } : {}),
    ...(variant === 'stack' ? { RAG_EVAL_IMPROVEMENT_LEVEL: '5' } : {}),
  };
  execSync(`npx tsx evals/rag/scripts/apply-migrations.ts ${variant}`, {
    stdio: 'inherit',
    env,
  });
}

export function seedCorpus(variant: 'baseline' | 'stack'): void {
  const fixtureExists = existsSync('evals/rag/fixtures/corpus-v2-bodies.json');
  execSync('npx tsx evals/rag/scripts/seed-corpus.ts', {
    stdio: 'inherit',
    env: { ...process.env, ...seedEnv(fixtureExists, variant) },
  });
}

export function loadRejectionThreshold(): number {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'evals/rag/config/rejection-threshold.json'), 'utf8'),
  ).threshold as number;
}

export async function evalVariant(
  variant: 'baseline' | 'stack',
  splits: Array<'dev' | 'test'> = ['dev', 'test'],
): Promise<Record<'dev' | 'test', V2EvalResult>> {
  const out: Partial<Record<'dev' | 'test', V2EvalResult>> = {};
  if (variant === 'stack') {
    process.env.RAG_RERANKER_ENABLED = '1';
    process.env.RAG_REJECTION_THRESHOLD = String(loadRejectionThreshold());
  } else {
    delete process.env.RAG_REJECTION_THRESHOLD;
    delete process.env.RAG_RERANKER_ENABLED;
  }
  for (const split of splits) {
    out[split] = await runEvalV2(split, variant);
  }
  return out as Record<'dev' | 'test', V2EvalResult>;
}
