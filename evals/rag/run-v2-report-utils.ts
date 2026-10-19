import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CATEGORIES = [
  'eksakt_sak',
  'tema',
  'prefiks_delord',
  'sammensatte_ord',
  'voteringer_parti',
  'horinger',
  'finnes_ikke',
] as const;

export type EvalJson = Record<string, unknown> & {
  byCategory?: Record<string, { n: number; rate: number }>;
  recallAt5?: number;
  chunkQuestions?: number;
  prefixHitRate?: number;
  finnesIkkeCorrectRejectionRate?: number;
  latencyMsP95?: number;
  skippedQuestions?: number;
};

export function formatSideBySide(dev: EvalJson, test: EvalJson): string {
  const devCat = dev.byCategory ?? {};
  const testCat = test.byCategory ?? {};
  const lines = [
    '| Category | dev n | dev % | test n | test % |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...CATEGORIES.map((c) => {
      const d = devCat[c] ?? { n: 0, rate: 0 };
      const t = testCat[c] ?? { n: 0, rate: 0 };
      return `| ${c} | ${d.n} | ${(d.rate * 100).toFixed(1)}% | ${t.n} | ${(t.rate * 100).toFixed(1)}% |`;
    }),
    '',
    '| Metric | dev | test |',
    '| --- | --- | --- |',
    `| **Aggregate sak R@5** (dev n=${dev.chunkQuestions ?? '?'}, test n=${test.chunkQuestions ?? '?'}) | **${(Number(dev.recallAt5) * 100).toFixed(1)}%** | **${(Number(test.recallAt5) * 100).toFixed(1)}%** (target ≥85%) |`,
    `| Prefix (prefiks_delord) | ${(Number(dev.prefixHitRate) * 100).toFixed(1)}% | ${(Number(test.prefixHitRate) * 100).toFixed(1)}% |`,
    `| Finnes-ikke reject | ${(Number(dev.finnesIkkeCorrectRejectionRate) * 100).toFixed(1)}% | ${(Number(test.finnesIkkeCorrectRejectionRate) * 100).toFixed(1)}% |`,
    `| p95 latency (ms) | ${Number(dev.latencyMsP95).toFixed(0)} | ${Number(test.latencyMsP95).toFixed(0)} |`,
    `| Skipped (hearing) | ${dev.skippedQuestions ?? 0} | ${test.skippedQuestions ?? 0} |`,
  ];
  return lines.join('\n');
}

export function formatBaselineVsStack(
  baseline: { dev: EvalJson; test: EvalJson },
  stack: { dev: EvalJson; test: EvalJson },
): string {
  const header = '| Category | base dev | stack dev | base test | stack test |';
  const sep = '| --- | ---: | ---: | ---: | ---: |';
  const rows = CATEGORIES.map((c) => {
    const bd = baseline.dev.byCategory?.[c] ?? { rate: 0 };
    const sd = stack.dev.byCategory?.[c] ?? { rate: 0 };
    const bt = baseline.test.byCategory?.[c] ?? { rate: 0 };
    const st = stack.test.byCategory?.[c] ?? { rate: 0 };
    return `| ${c} | ${(bd.rate * 100).toFixed(1)}% | ${(sd.rate * 100).toFixed(1)}% | ${(bt.rate * 100).toFixed(1)}% | ${(st.rate * 100).toFixed(1)}% |`;
  });
  const metrics = [
    '',
    '| Metric | base dev | stack dev | base test | stack test |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| Aggregate sak R@5 | ${(Number(baseline.dev.recallAt5) * 100).toFixed(1)}% | ${(Number(stack.dev.recallAt5) * 100).toFixed(1)}% | ${(Number(baseline.test.recallAt5) * 100).toFixed(1)}% | ${(Number(stack.test.recallAt5) * 100).toFixed(1)}% |`,
    `| p95 ms | ${Number(baseline.dev.latencyMsP95).toFixed(0)} | ${Number(stack.dev.latencyMsP95).toFixed(0)} | ${Number(baseline.test.latencyMsP95).toFixed(0)} | ${Number(stack.test.latencyMsP95).toFixed(0)} |`,
  ];
  return [header, sep, ...rows, ...metrics].join('\n');
}

export function writeFinalReport(args: {
  label: string;
  sha: string;
  meta: Record<string, unknown>;
  dev: EvalJson;
  test: EvalJson;
  distractorChunks: boolean;
}): string {
  const side = formatSideBySide(args.dev, args.test);
  const r5Test = Number(args.test.recallAt5) * 100;
  const r5Ok = r5Test >= 85;
  return [
    `# ${args.label}`,
    '',
    `**Git SHA:** \`${args.sha}\``,
    `**Distractor chunks in index:** ${args.distractorChunks ? 'yes (list metadata per sak)' : 'no (CI fast mode — FTS-only distractors)'}`,
    `**Corpus:** ${args.meta.corpusIssues ?? args.meta.issues} issues, ${args.meta.chunks} chunks, ${args.meta.hearings} hearings.`,
    '',
    `**Aggregate sak R@5 (test):** ${r5Test.toFixed(1)}% ${r5Ok ? '✓' : '✗ below 85% target'}`,
    '',
    side,
  ].join('\n');
}

export function saveCompareReport(path: string, body: string): void {
  writeFileSync(join(process.cwd(), 'evals/rag/results', path), body);
}
