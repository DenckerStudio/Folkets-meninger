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
    improvementLevel: '2',
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
  const env = {
    ...process.env,
    RAG_EVAL_IMPROVEMENT_LEVEL: round.improvementLevel,
    RAG_EVAL_LABEL: round.label,
    PGPASSWORD: process.env.RAG_EVAL_PG_PASSWORD ?? 'rag_eval',
    ...round.extraEnv,
  };
  if (round.label === 'round3-rerank-reject') {
    const t = loadThreshold();
    if (t) env.RAG_REJECTION_THRESHOLD = t;
    else env.RAG_REJECTION_THRESHOLD = '0.018';
  }
  if (round.extraEnv?.RAG_EVAL_RUN === 'baseline') {
    execSync('npx tsx evals/rag/scripts/apply-migrations.ts baseline', { stdio: 'inherit', env });
  } else {
    execSync('npx tsx evals/rag/scripts/apply-migrations.ts stack', { stdio: 'inherit', env });
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
    const result = JSON.parse(readFileSync(join(outDir, `${round.label}.json`), 'utf8')) as Record<string, number>;
    const reject =
      result.finnesIkkeCorrectRejectionRate !== undefined
        ? (Number(result.finnesIkkeCorrectRejectionRate) * 100).toFixed(1)
        : 'n/a';
    const centralP95 = Number(result.centralEmbedMsP95 ?? 0).toFixed(0);
    const byokOffP95 = Number(result.byokEmbedOffMsP95 ?? 0).toFixed(0);
    const byokOnP95 = Number(result.byokEmbedOnMsP95 ?? 0).toFixed(0);
    table.push(
      `| ${round.label} | ${(Number(result.issueSearchHitRate) * 100).toFixed(1)}% | ${(Number(result.prefixHitRate) * 100).toFixed(1)}% | ${reject}% | ${(Number(result.recallAt5) * 100).toFixed(1)}% | ${Number(result.latencyMsP95).toFixed(0)} | ${centralP95} | ${byokOffP95} | ${byokOnP95} |`,
    );
  }
  const md = [
    '| Round | Issue search | Prefix | Finnes-ikke reject | R@5 | Retrieval p95 | Central embed p95 | BYOK embed p95 (800ms) | BYOK embed p95 (3s) |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...table,
  ].join('\n');
  writeFileSync(join(outDir, 'improvement-rounds.md'), `${md}\n`);
  console.log('\n' + md);
}

main();
