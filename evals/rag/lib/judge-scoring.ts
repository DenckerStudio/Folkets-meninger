import {
  citationRuleFaithfulnessCap,
  quantizeScore025,
  type PerRowDeterministicMetrics,
} from './answer-metrics';
import type { ParsedJudgeScores } from './judge-parse';

export type JudgedRowOutput = {
  id: string;
  deterministic: PerRowDeterministicMetrics;
  faithfulness?: number;
  quality?: number;
  faithfulnessRaw?: number;
  qualityRaw?: number;
  /** min(LLM faithfulness, deterministic citation rule cap), quantized. */
  faithfulnessCombined?: number;
  citationRuleCap?: number;
  note?: string;
  incorrectRefusalOverride?: boolean;
  judgeError?: string;
};

export function applyParsedJudgeScores(
  row: { id: string; goldFacts: string[] },
  deterministic: PerRowDeterministicMetrics,
  parsed: ParsedJudgeScores,
): JudgedRowOutput {
  let faithRaw = parsed.faithfulness;
  let qualRaw = parsed.quality;
  let incorrectRefusalOverride = false;
  if (deterministic.incorrectRefusal) {
    qualRaw = 0;
    incorrectRefusalOverride = true;
  }
  if (row.goldFacts.length > 0 && !deterministic.goldFactsHit && qualRaw > 0.25) {
    qualRaw = 0.25;
  }
  const citationRuleCap = citationRuleFaithfulnessCap(deterministic.citationAudit);
  const faithCombinedRaw = Math.min(faithRaw, citationRuleCap);
  if (!deterministic.citationAudit.citationSupportPass && faithRaw > faithCombinedRaw) {
    qualRaw = Math.min(qualRaw, 0.5);
  }
  return {
    id: row.id,
    deterministic,
    faithfulness: quantizeScore025(faithRaw),
    quality: quantizeScore025(qualRaw),
    faithfulnessRaw: faithRaw,
    qualityRaw: qualRaw,
    faithfulnessCombined: quantizeScore025(faithCombinedRaw),
    citationRuleCap,
    note: parsed.justification || 'no_justification',
    incorrectRefusalOverride,
  };
}

export function summarizeLlmJudged(rows: JudgedRowOutput[]): {
  count: number;
  judgeErrorCount: number;
  judgeErrorRate: number;
  faithfulnessMean: number;
  faithfulnessCombinedMean: number;
  qualityMean: number;
  faithfulnessPassRate: number;
  maxScoreFraction: number;
  citationSupportPassRate: number;
} {
  const judged = rows.filter((r) => !r.judgeError && r.faithfulness !== undefined);
  const judgeErrorCount = rows.filter((r) => r.judgeError).length;
  const n = judged.length || 1;
  const faith = judged.reduce((s, r) => s + (r.faithfulness ?? 0), 0) / n;
  const faithCombined =
    judged.reduce((s, r) => s + (r.faithfulnessCombined ?? r.faithfulness ?? 0), 0) / n;
  const qual = judged.reduce((s, r) => s + (r.quality ?? 0), 0) / n;
  const pass = judged.filter((r) => (r.faithfulnessCombined ?? r.faithfulness ?? 0) >= 0.7).length / n;
  const maxBoth = judged.filter((r) => r.faithfulness === 1 && r.quality === 1).length / n;
  const citationPass =
    judged.filter((r) => r.deterministic.citationAudit.citationSupportPass).length / n;
  const denom = rows.length || 1;
  return {
    count: judged.length,
    judgeErrorCount,
    judgeErrorRate: judgeErrorCount / denom,
    faithfulnessMean: judged.length === 0 ? 0 : faith,
    faithfulnessCombinedMean: judged.length === 0 ? 0 : faithCombined,
    qualityMean: judged.length === 0 ? 0 : qual,
    faithfulnessPassRate: judged.length === 0 ? 0 : pass,
    maxScoreFraction: judged.length === 0 ? 0 : maxBoth,
    citationSupportPassRate: judged.length === 0 ? 0 : citationPass,
  };
}

export function isResumeCompleteRow(row: JudgedRowOutput): boolean {
  return !row.judgeError && row.faithfulness !== undefined && row.quality !== undefined;
}
