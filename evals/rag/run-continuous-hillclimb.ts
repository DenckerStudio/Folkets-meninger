/**
 * Continuous harness loop: baseline + stack rounds, target check, append results, git push per round.
 * Does not tune on test — rejection threshold stays dev-calibrated.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkTargets, formatTableRow, loadResult, TARGETS } from './scripts/check-targets';

type ImprovementRound = {
  label: string;
  level: string;
  rerank?: boolean;
  reseedStack?: boolean;
};

const IMPROVEMENT_ROUNDS: ImprovementRound[] = [
  { label: 'round1-sak-search', level: '1' },
  { label: 'round2-prefix-trgm', level: '2' },
  { label: 'round3-rerank-reject', level: '3', rerank: true },
  { label: 'round4-issue-ilike', level: '4', rerank: true },
];

const HEADER =
  '| Round | Seed issues | Seed docs | Seed chunks | R@5 | MRR | Prefix | Finnes-ikke reject | Issue search | Retrieval p95 |\n' +
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n';

function run(cmd: string, env: Record<string, string> = {}): void {
  const mergedEnv = { ...process.env, ...env, PGPASSWORD: process.env.RAG_EVAL_PG_PASSWORD ?? 'rag_eval' };
  execSync(cmd, { stdio: 'inherit', env: mergedEnv });
}

function ensureResultsHeader(): void {
  const path = join(process.cwd(), 'evals/rag/results/improvement-rounds.md');
  if (!existsSync(path) || readFileSync(path, 'utf8').trim().length === 0) {
    writeFileSync(path, HEADER);
  } else if (!readFileSync(path, 'utf8').includes('Seed issues')) {
    writeFileSync(path, HEADER);
  }
}

function appendRow(label: string): void {
  const r = loadResult(label);
  const path = join(process.cwd(), 'evals/rag/results/improvement-rounds.md');
  appendFileSync(path, `${formatTableRow(label, r)}\n`);
}

function gitPushRound(label: string, message: string): void {
  run(`git add evals/rag/results/${label}.json evals/rag/results/improvement-rounds.md evals/rag/config/rejection-threshold.json`);
  try {
    run(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    run('git push -u origin cursor/rag-improve-drastisk-5738');
  } catch {
    console.warn('[hillclimb] nothing to commit or push failed');
  }
}

function runBaselineAndStack(): void {
  const baseEnv = { RAG_EVAL_RESET_DB: '1', RAG_EVAL_IMPROVEMENT_LEVEL: '0' };
  run('npx tsx evals/rag/scripts/apply-migrations.ts baseline', { ...baseEnv, RAG_EVAL_LABEL: 'baseline-main' });
  run('RAG_EVAL_VARIANT=baseline npx tsx evals/rag/scripts/seed-corpus.ts', baseEnv);
  run('npx tsx evals/rag/run-eval.ts', {
    ...baseEnv,
    RAG_EVAL_RUN: 'baseline',
    RAG_EVAL_LABEL: 'baseline-main',
  });
  appendRow('baseline-main');

  run('npx tsx evals/rag/scripts/apply-migrations.ts stack', { ...baseEnv, RAG_EVAL_LABEL: 'stack-previous' });
  run('RAG_EVAL_VARIANT=stack npx tsx evals/rag/scripts/seed-corpus.ts', baseEnv);
  run('npx tsx evals/rag/run-eval.ts', {
    ...baseEnv,
    RAG_EVAL_RUN: 'stack',
    RAG_EVAL_LABEL: 'stack-previous',
  });
  appendRow('stack-previous');
  gitPushRound('stack-previous', 'eval(rag): baseline+stack seed fixture (hillclimb)');
}

function runImprovementRound(round: ImprovementRound): void {
  const env: Record<string, string> = {
    RAG_EVAL_IMPROVEMENT_ONLY: round.reseedStack ? '0' : '1',
    RAG_EVAL_IMPROVEMENT_LEVEL: round.level,
    RAG_EVAL_RUN: 'stack',
    RAG_EVAL_LABEL: round.label,
  };
  if (round.reseedStack) {
    env.RAG_EVAL_RESET_DB = '1';
    run('npx tsx evals/rag/scripts/apply-migrations.ts stack', env);
    run('RAG_EVAL_VARIANT=stack npx tsx evals/rag/scripts/seed-corpus.ts', env);
  }
  if (round.rerank) {
    run('npx tsx evals/rag/scripts/calibrate-rejection.ts', env);
    try {
      const t = JSON.parse(
        readFileSync(join(process.cwd(), 'evals/rag/config/rejection-threshold.json'), 'utf8'),
      ) as { threshold?: number };
      if (typeof t.threshold === 'number') env.RAG_REJECTION_THRESHOLD = String(t.threshold);
    } catch {
      env.RAG_REJECTION_THRESHOLD = '0.018';
    }
    env.RAG_RERANKER_ENABLED = '1';
  }
  run('npx tsx evals/rag/scripts/apply-migrations.ts stack', env);
  run('npx tsx evals/rag/run-eval.ts', env);
  run(`npx tsx evals/rag/scripts/analyze-eval-failures.ts ${round.label}`);
  appendRow(round.label);
  gitPushRound(round.label, `eval(rag): ${round.label} harness`);
}

function main(): void {
  ensureResultsHeader();
  const baselinePath = join(process.cwd(), 'evals/rag/results/baseline-main.json');
  if (!existsSync(baselinePath)) {
    runBaselineAndStack();
  }
  const baseline = loadResult('baseline-main');
  let roundIndex = 0;
  for (const round of IMPROVEMENT_ROUNDS) {
    roundIndex += 1;
    console.log(`\n[hillclimb] === ${round.label} (round ${roundIndex}) ===\n`);
    runImprovementRound(round);
    const stack = loadResult(round.label);
    const { met, gaps } = checkTargets(stack, baseline);
    console.log(`[hillclimb] targets met=${met}`, gaps.join('; ') || 'ok');
    if (met) {
      console.log('[hillclimb] all targets met on test split');
      break;
    }
  }
  console.log('[hillclimb] done. Targets:', TARGETS);
}

main();
