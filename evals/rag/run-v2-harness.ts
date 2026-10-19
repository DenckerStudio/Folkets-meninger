import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runEvalV2 } from './run-eval-v2';

const TARGETS = { recallAt5: 0.85, prefixHitRate: 0.8, finnesIkkeCorrectRejectionRate: 0.8, latencyMsP95: 800 };

const CATEGORIES = [
  'eksakt_sak',
  'tema',
  'prefiks_delord',
  'sammensatte_ord',
  'voteringer_parti',
  'horinger',
  'finnes_ikke',
] as const;

function runShell(cmd: string, extraEnv: Record<string, string> = {}): void {
  const env = {
    ...process.env,
    RAG_EVAL_DATASET: 'v2',
    PGPASSWORD: process.env.RAG_EVAL_PG_PASSWORD ?? 'rag_eval',
    ...extraEnv,
  };
  execSync(cmd, { stdio: 'inherit', env });
}

function formatSideBySide(
  dev: Record<string, unknown>,
  test: Record<string, unknown>,
): string {
  const devCat = dev.byCategory as Record<string, { n: number; rate: number }>;
  const testCat = test.byCategory as Record<string, { n: number; rate: number }>;
  const lines = [
    '| Category | dev n | dev % | test n | test % |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...CATEGORIES.map((c) => {
      const d = devCat[c] ?? { n: 0, rate: 0 };
      const t = testCat[c] ?? { n: 0, rate: 0 };
      return `| ${c} | ${d.n} | ${(d.rate * 100).toFixed(1)}% | ${t.n} | ${(t.rate * 100).toFixed(1)}% |`;
    }),
    '',
    `| | dev | test |`,
    `| --- | --- | --- |`,
    `| Sak R@5 | ${(Number(dev.recallAt5) * 100).toFixed(1)}% | ${(Number(test.recallAt5) * 100).toFixed(1)}% |`,
    `| Prefix | ${(Number(dev.prefixHitRate) * 100).toFixed(1)}% | ${(Number(test.prefixHitRate) * 100).toFixed(1)}% |`,
    `| Finnes-ikke reject | ${(Number(dev.finnesIkkeCorrectRejectionRate) * 100).toFixed(1)}% | ${(Number(test.finnesIkkeCorrectRejectionRate) * 100).toFixed(1)}% |`,
    `| p95 latency (ms) | ${Number(dev.latencyMsP95).toFixed(0)} | ${Number(test.latencyMsP95).toFixed(0)} |`,
    `| Skipped (hearing) | ${dev.skippedQuestions ?? 0} | ${test.skippedQuestions ?? 0} |`,
  ];
  return lines.join('\n');
}

async function main(): Promise<void> {
  runShell('npx tsx evals/rag/scripts/apply-migrations.ts stack', {
    RAG_EVAL_RESET_DB: '1',
    RAG_EVAL_IMPROVEMENT_LEVEL: '4',
  });
  const fixtureExists = existsSync('evals/rag/fixtures/corpus-v2-bodies.json');
  runShell('RAG_EVAL_VARIANT=stack npx tsx evals/rag/scripts/seed-corpus.ts', {
    ...(fixtureExists ? { RAG_EVAL_V2_SKIP_ISSUE_FETCH: '1' } : {}),
    RAG_EVAL_V2_VOTERING_ALL_CORE: '1',
    RAG_EVAL_V2_SKIP_DISTRACTOR_CHUNKS: '1',
  });
  runShell('npx tsx evals/rag/scripts/calibrate-rejection.ts', { RAG_EVAL_DATASET: 'v2' });

  const threshold = JSON.parse(
    readFileSync(join(process.cwd(), 'evals/rag/config/rejection-threshold.json'), 'utf8'),
  ).threshold;

  const dev = await runEvalV2('dev', 'stack');
  const test = await runEvalV2('test', 'stack');

  const outDir = join(process.cwd(), 'evals/rag/results');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'v2-dev-round4-stack.json'), JSON.stringify(dev, null, 2));
  writeFileSync(join(outDir, 'v2-test-round4-stack.json'), JSON.stringify(test, null, 2));

  const sideBySide = formatSideBySide(dev, test);
  writeFileSync(join(outDir, 'v2-dev-test-round4-stack.md'), `# RAG eval v2 dev vs test (round4 stack)\n\n${sideBySide}\n`);

  const byCat = test.byCategory as Record<string, { n: number; rate: number }>;
  const gaps: string[] = [];
  if (Number(test.recallAt5) < TARGETS.recallAt5) gaps.push(`sak R@5 ${(Number(test.recallAt5) * 100).toFixed(1)}%`);
  if (Number(test.prefixHitRate) < TARGETS.prefixHitRate) {
    gaps.push(`prefix ${(Number(test.prefixHitRate) * 100).toFixed(1)}%`);
  }
  if (Number(test.finnesIkkeCorrectRejectionRate) < TARGETS.finnesIkkeCorrectRejectionRate) {
    gaps.push(`reject ${(Number(test.finnesIkkeCorrectRejectionRate) * 100).toFixed(1)}%`);
  }
  if (Number(test.latencyMsP95) > TARGETS.latencyMsP95) gaps.push(`p95 ${test.latencyMsP95}ms`);
  if ((byCat.horinger?.n ?? 0) < 15) gaps.push(`horinger scored n=${byCat.horinger?.n ?? 0} (want ≥15)`);
  if ((byCat.voteringer_parti?.rate ?? 0) < 0.7) {
    gaps.push(`voteringer_parti ${((byCat.voteringer_parti?.rate ?? 0) * 100).toFixed(1)}%`);
  }

  const meta = JSON.parse(readFileSync(join(process.cwd(), 'evals/rag/corpus-meta.json'), 'utf8')) as {
    corpusIssues?: number;
    issues?: number;
    hearings?: number;
    excludedHearings?: unknown[];
    chunks?: number;
  };

  const report = [
    '# v2 held-out test report (round4 stack, realistic corpus)',
    '',
    `Corpus: ${meta.corpusIssues ?? meta.issues ?? '?'} issues indexed (${meta.distractorIssues ?? '?'} distractors + ${meta.coreIssues ?? '?'} core), ${meta.chunks ?? '?'} chunks, ${meta.hearings ?? '?'} hearings seeded, ${meta.excludedHearings?.length ?? 0} hearings excluded (not faked).`,
    `Rejection threshold (dev-calibrated): ${threshold}`,
    '',
    `Targets met: ${gaps.length === 0 ? 'yes' : `no (${gaps.join(', ')})`}`,
    '',
    '## Dev vs test',
    '',
    sideBySide,
    '',
    'Caveats: `tema` labels may be weak; `finnes_ikke` GT is title-only (see finnesIkkeFullTextHits in JSON).',
  ].join('\n');
  writeFileSync(join(outDir, 'v2-test-report.md'), report);
  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
