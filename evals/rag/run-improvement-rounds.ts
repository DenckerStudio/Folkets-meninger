import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Round = {
  label: string;
  improvementLevel: string;
  extraEnv?: Record<string, string>;
};

const ROUNDS: Round[] = [
  { label: 'baseline-main', improvementLevel: '0', extraEnv: { RAG_EVAL_RUN: 'baseline' } },
  { label: 'stack-previous', improvementLevel: '0', extraEnv: { RAG_EVAL_RUN: 'stack' } },
  { label: 'round1-sak-search', improvementLevel: '1', extraEnv: { RAG_EVAL_RUN: 'stack' } },
  { label: 'round2-prefix-trgm', improvementLevel: '2', extraEnv: { RAG_EVAL_RUN: 'stack' } },
  {
    label: 'round3-rerank-reject',
    improvementLevel: '3',
    extraEnv: {
      RAG_EVAL_RUN: 'stack',
      RAG_RERANKER_ENABLED: '1',
    },
  },
  {
    label: 'round4-issue-ilike',
    improvementLevel: '4',
    extraEnv: {
      RAG_EVAL_RUN: 'stack',
      RAG_RERANKER_ENABLED: '1',
    },
  },
];

function loadThreshold(): string | undefined {
  try {
    const raw = readFileSync(join(process.cwd(), 'evals/rag/config/rejection-threshold.json'), 'utf8');
    const j = JSON.parse(raw) as { threshold?: number };
    if (typeof j.threshold === 'number') return String(j.threshold);
  } catch {
    return undefined;
  }
  return undefined;
}

function runRound(round: Round): void {
  const env: Record<string, string> = {
    ...process.env,
    RAG_EVAL_IMPROVEMENT_LEVEL: round.improvementLevel,
    RAG_EVAL_LABEL: round.label,
    PGPASSWORD: process.env.RAG_EVAL_PG_PASSWORD ?? 'rag_eval',
    ...round.extraEnv,
  } as Record<string, string>;

  if (round.label === 'baseline-main') {
    env.RAG_EVAL_RESET_DB = '1';
    delete env.RAG_EVAL_IMPROVEMENT_ONLY;
  } else if (round.label === 'stack-previous') {
    env.RAG_EVAL_RESET_DB = '1';
    delete env.RAG_EVAL_IMPROVEMENT_ONLY;
  } else {
    env.RAG_EVAL_IMPROVEMENT_ONLY = '1';
    delete env.RAG_EVAL_RESET_DB;
  }
  if (round.label === 'round3-rerank-reject' || round.label === 'round4-issue-ilike') {
    try {
      execSync('npx tsx evals/rag/scripts/calibrate-rejection.ts', { stdio: 'inherit', env });
    } catch {
      console.warn('[rounds] calibrate-rejection failed; using config/default threshold');
    }
    const t = loadThreshold();
    if (t) env.RAG_REJECTION_THRESHOLD = t;
    else env.RAG_REJECTION_THRESHOLD = '0.018';
  }
  if (round.extraEnv?.RAG_EVAL_RUN === 'baseline') {
    execSync('npx tsx evals/rag/scripts/apply-migrations.ts baseline', { stdio: 'inherit', env });
  } else {
    execSync('npx tsx evals/rag/scripts/apply-migrations.ts stack', { stdio: 'inherit', env });
  }
  if (round.label === 'baseline-main') {
    execSync('RAG_EVAL_VARIANT=baseline npx tsx evals/rag/scripts/seed-corpus.ts', {
      stdio: 'inherit',
      env,
    });
  }
  if (round.label === 'stack-previous') {
    execSync('RAG_EVAL_VARIANT=stack npx tsx evals/rag/scripts/seed-corpus.ts', {
      stdio: 'inherit',
      env,
    });
  }
  execSync('npx tsx evals/rag/run-eval.ts', { stdio: 'inherit', env });
}

function main(): void {
  const outDir = join(process.cwd(), 'evals/rag/results');
  mkdirSync(outDir, { recursive: true });
  const table: string[] = [];
  for (const round of ROUNDS) {
    console.log(`\n[rounds] === ${round.label} ===\n`);
    runRound(round);
    const result = JSON.parse(readFileSync(join(outDir, `${round.label}.json`), 'utf8')) as Record<
      string,
      number | Record<string, unknown>
    >;
    const seed = (result.seedCounts ?? {}) as Record<string, number>;
    const seedIssues = seed.issues ?? seed.issueCount ?? '—';
    const seedDocs = seed.documents ?? '—';
    const seedChunks = seed.chunks ?? '—';
    const reject =
      result.finnesIkkeCorrectRejectionRate !== undefined
        ? (Number(result.finnesIkkeCorrectRejectionRate) * 100).toFixed(1)
        : 'n/a';
    const centralP95 = Number(result.centralEmbedMsP95 ?? 0).toFixed(0);
    const byokOffP95 = Number(result.byokEmbedOffMsP95 ?? 0).toFixed(0);
    const byokOnP95 = Number(result.byokEmbedOnMsP95 ?? 0).toFixed(0);
    table.push(
      `| ${round.label} | ${seedIssues} | ${seedDocs} | ${seedChunks} | ${(Number(result.recallAt5) * 100).toFixed(1)}% | ${Number(result.mrr).toFixed(3)} | ${(Number(result.prefixHitRate) * 100).toFixed(1)}% | ${reject}% | ${(Number(result.issueSearchHitRate) * 100).toFixed(1)}% | ${Number(result.latencyMsP95).toFixed(0)} | ${centralP95} | ${byokOffP95} | ${byokOnP95} |`,
    );
  }
  const md = [
    '| Round | Seed issues | Seed docs | Seed chunks | R@5 | MRR | Prefix | Finnes-ikke reject | Issue search | Retrieval p95 | Central embed p95 | BYOK p95 @800ms | BYOK p95 @3s |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...table,
  ].join('\n');
  writeFileSync(join(outDir, 'improvement-rounds.md'), `${md}\n`);
  console.log('\n' + md);
}

main();
