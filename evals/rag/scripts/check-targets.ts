import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type EvalMetrics = {
  recallAt5: number;
  prefixHitRate: number;
  finnesIkkeCorrectRejectionRate: number;
  issueSearchHitRate: number;
  excerptFactRate: number;
  topicExcerptFactRate: number;
  mrr: number;
  latencyMsP95: number;
  seedCounts?: Record<string, unknown>;
};

export const TARGETS = {
  recallAt5: 0.85,
  prefixHitRate: 0.8,
  finnesIkkeCorrectRejectionRate: 0.8,
  latencyMsP95: 800,
};

export function loadResult(label: string): EvalMetrics {
  const path = join(process.cwd(), 'evals/rag/results', `${label}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as EvalMetrics;
}

export function checkTargets(stack: EvalMetrics, baseline: EvalMetrics): { met: boolean; gaps: string[] } {
  const gaps: string[] = [];
  if (stack.recallAt5 < TARGETS.recallAt5) {
    gaps.push(`R@5 ${(stack.recallAt5 * 100).toFixed(1)}% < ${TARGETS.recallAt5 * 100}%`);
  }
  if (stack.prefixHitRate < TARGETS.prefixHitRate) {
    gaps.push(`Prefix ${(stack.prefixHitRate * 100).toFixed(1)}% < ${TARGETS.prefixHitRate * 100}%`);
  }
  if (stack.finnesIkkeCorrectRejectionRate < TARGETS.finnesIkkeCorrectRejectionRate) {
    gaps.push(
      `Reject ${(stack.finnesIkkeCorrectRejectionRate * 100).toFixed(1)}% < ${TARGETS.finnesIkkeCorrectRejectionRate * 100}%`,
    );
  }
  if (stack.latencyMsP95 > TARGETS.latencyMsP95) {
    gaps.push(`p95 ${stack.latencyMsP95.toFixed(0)}ms > ${TARGETS.latencyMsP95}ms`);
  }
  const regressEps = 0.02;
  if (stack.excerptFactRate + regressEps < baseline.excerptFactRate) {
    gaps.push(`excerpt regression ${(stack.excerptFactRate * 100).toFixed(1)}% vs baseline ${(baseline.excerptFactRate * 100).toFixed(1)}%`);
  }
  if (stack.issueSearchHitRate + regressEps < baseline.issueSearchHitRate) {
    gaps.push(
      `issue-search regression ${(stack.issueSearchHitRate * 100).toFixed(1)}% vs baseline ${(baseline.issueSearchHitRate * 100).toFixed(1)}%`,
    );
  }
  return { met: gaps.length === 0, gaps };
}

export function formatTableRow(label: string, r: EvalMetrics): string {
  const seed = (r.seedCounts ?? {}) as Record<string, number>;
  const seedIssues = seed.issues ?? '—';
  const seedDocs = seed.documents ?? '—';
  const seedChunks = seed.chunks ?? '—';
  const reject = (r.finnesIkkeCorrectRejectionRate * 100).toFixed(1);
  return `| ${label} | ${seedIssues} | ${seedDocs} | ${seedChunks} | ${(r.recallAt5 * 100).toFixed(1)}% | ${r.mrr.toFixed(3)} | ${(r.prefixHitRate * 100).toFixed(1)}% | ${reject}% | ${(r.issueSearchHitRate * 100).toFixed(1)}% | ${r.latencyMsP95.toFixed(0)} |`;
}
