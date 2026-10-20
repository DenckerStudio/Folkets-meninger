import {
  GOLD_FACTS_HIT_TARGET,
  REFUSAL_RATE_TARGET,
  scoreDeterministicRow,
  summarizeGoldFacts,
  summarizeRefusals,
  summarizeSourceDiversity,
  type AnswerMetricsRow,
  type PerRowDeterministicMetrics,
} from './answer-metrics';

export type AnswerInputRow = AnswerMetricsRow & {
  generationError?: string;
  answerModel?: string;
};

export function buildDeterministicReport(rows: AnswerInputRow[]): {
  rowCount: number;
  rowsWithGenerationError: number;
  perRow: PerRowDeterministicMetrics[];
  goldFacts: ReturnType<typeof summarizeGoldFacts>;
  refusals: ReturnType<typeof summarizeRefusals>;
  sourceDiversity: ReturnType<typeof summarizeSourceDiversity>;
  targets: {
    goldFactsHitRateMin: number;
    goldFactsHitRateMet: boolean;
    refusalRateMax: number;
    refusalRateMet: boolean;
  };
} {
  const scorable = rows.filter((r) => !r.generationError && r.answer?.trim());
  const categoryById = new Map(rows.map((r) => [r.id, r.category ?? '']));
  const perRow = scorable.map((r) =>
    scoreDeterministicRow({
      id: r.id,
      category: r.category,
      query: r.query,
      answer: r.answer,
      excerpts: r.excerpts,
      goldFacts: r.goldFacts,
    }),
  );
  const goldFacts = summarizeGoldFacts(perRow);
  const refusals = summarizeRefusals(perRow);
  const sourceDiversity = summarizeSourceDiversity(perRow, categoryById);
  return {
    rowCount: rows.length,
    rowsWithGenerationError: rows.filter((r) => r.generationError).length,
    perRow,
    goldFacts,
    refusals,
    sourceDiversity,
    targets: {
      goldFactsHitRateMin: GOLD_FACTS_HIT_TARGET,
      goldFactsHitRateMet: goldFacts.meanHitRate >= GOLD_FACTS_HIT_TARGET,
      refusalRateMax: REFUSAL_RATE_TARGET,
      refusalRateMet: refusals.incorrectRefusalRate <= REFUSAL_RATE_TARGET,
    },
  };
}
