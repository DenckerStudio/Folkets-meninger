/**
 * Deterministic answer / retrieval metrics for RAG eval (no LLM).
 */

export type AnswerMetricsRow = {
  id: string;
  category?: string;
  query: string;
  answer: string;
  excerpts: string[];
  goldFacts: string[];
};

export type PerRowDeterministicMetrics = {
  id: string;
  category?: string;
  goldFacts: string[];
  goldFactHits: boolean[];
  goldFactsHitRate: number;
  goldFactsHit: boolean;
  isRefusal: boolean;
  incorrectRefusal: boolean;
  correctRefusal: boolean;
  retrievalSourceKeys: string[];
  answerSourceKeys: string[];
};

const REFUSAL_PATTERNS = [
  /\bkildene\s+inneholder\s+ikke\b/i,
  /\bkan\s+ikke\s+besvare\b/i,
  /\bfinnes\s+ikke\s+(?:nok\s+)?informasjon\b/i,
  /\bikke\s+nok\s+.*\bkildene\b/i,
  /\bspørsmålet\s+kan\s+ikke\s+besvares\b/i,
  /\bmangler\s+informasjon\s+i\s+kildene\b/i,
];

export function normalizeMetricText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fuzzyFactInText(text: string, fact: string): boolean {
  const hay = normalizeMetricText(text);
  const needle = normalizeMetricText(fact);
  if (!needle) return true;
  if (hay.includes(needle)) return true;
  const compactHay = hay.replace(/[-\s]/g, '');
  const compactNeedle = needle.replace(/[-\s]/g, '');
  if (compactNeedle.length >= 4 && compactHay.includes(compactNeedle)) return true;
  const alt = needle.replace(/-/g, ' ');
  return alt !== needle && hay.includes(alt);
}

export function scoreGoldFactsInAnswer(answer: string, goldFacts: string[]): {
  perFact: boolean[];
  hitRate: number;
  hit: boolean;
} {
  if (goldFacts.length === 0) {
    return { perFact: [], hitRate: 1, hit: true };
  }
  const perFact = goldFacts.map((f) => fuzzyFactInText(answer, f));
  const hitRate = perFact.filter(Boolean).length / goldFacts.length;
  return { perFact, hitRate, hit: perFact.every(Boolean) };
}

export function isRefusalAnswer(answer: string): boolean {
  const a = answer.trim();
  if (!a) return false;
  return REFUSAL_PATTERNS.some((re) => re.test(a));
}

const DOKUMENT_REF = /(?:dokument|dok\.?)\s*(\d+)\s*:\s*(\d+)\s*([sl])/gi;
const PROP_REF = /prop\.?\s*(\d+)\s*([sl])/gi;
const INNST_REF = /innst\.?\s*(\d+)\s*([sl])/gi;

/** Stable keys for diversity (e.g. `dok:8:15:S`, `prop:82:L`). */
export function extractSourceKeys(text: string): string[] {
  const keys = new Set<string>();
  let m: RegExpExecArray | null;
  const docRe = new RegExp(DOKUMENT_REF.source, 'gi');
  while ((m = docRe.exec(text)) !== null) {
    keys.add(`dok:${m[1]}:${m[2]}:${m[3].toUpperCase()}`);
  }
  const propRe = new RegExp(PROP_REF.source, 'gi');
  while ((m = propRe.exec(text)) !== null) {
    keys.add(`prop:${m[1]}:${m[2].toUpperCase()}`);
  }
  const innstRe = new RegExp(INNST_REF.source, 'gi');
  while ((m = innstRe.exec(text)) !== null) {
    keys.add(`innst:${m[1]}:${m[2].toUpperCase()}`);
  }
  return [...keys];
}

export function scoreDeterministicRow(row: AnswerMetricsRow): PerRowDeterministicMetrics {
  const { perFact, hitRate, hit } = scoreGoldFactsInAnswer(row.answer, row.goldFacts);
  const refusal = isRefusalAnswer(row.answer);
  const hasGold = row.goldFacts.length > 0;
  return {
    id: row.id,
    category: row.category,
    goldFacts: row.goldFacts,
    goldFactHits: perFact,
    goldFactsHitRate: hitRate,
    goldFactsHit: hit,
    isRefusal: refusal,
    incorrectRefusal: refusal && hasGold,
    correctRefusal: refusal && !hasGold,
    retrievalSourceKeys: extractSourceKeys(row.excerpts.join('\n')),
    answerSourceKeys: extractSourceKeys(row.answer),
  };
}

export function summarizeGoldFacts(rows: PerRowDeterministicMetrics[]): {
  rowsWithGold: number;
  meanHitRate: number;
  fullHitRate: number;
} {
  const withGold = rows.filter((r) => r.goldFacts.length > 0);
  const n = withGold.length || 1;
  return {
    rowsWithGold: withGold.length,
    meanHitRate: withGold.reduce((s, r) => s + r.goldFactsHitRate, 0) / n,
    fullHitRate: withGold.filter((r) => r.goldFactsHit).length / n,
  };
}

export function summarizeRefusals(rows: PerRowDeterministicMetrics[]): {
  incorrectRefusalRate: number;
  correctRefusalRate: number;
  rowsWithGold: number;
  rowsWithoutGold: number;
} {
  const withGold = rows.filter((r) => r.goldFacts.length > 0);
  const withoutGold = rows.filter((r) => r.goldFacts.length === 0);
  return {
    rowsWithGold: withGold.length,
    rowsWithoutGold: withoutGold.length,
    incorrectRefusalRate:
      withGold.length === 0 ? 0 : withGold.filter((r) => r.incorrectRefusal).length / withGold.length,
    correctRefusalRate:
      withoutGold.length === 0 ? 0 : withoutGold.filter((r) => r.correctRefusal).length / withoutGold.length,
  };
}

export function summarizeSourceDiversity(
  rows: PerRowDeterministicMetrics[],
  categories?: Map<string, string>,
): {
  top3DocumentShare: number;
  uniqueSourceKeysPerTopicMean: number;
  mostCitedSourceKeys: Array<{ key: string; count: number }>;
} {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const keys = row.answerSourceKeys.length > 0 ? row.answerSourceKeys : row.retrievalSourceKeys;
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const totalCitations = sorted.reduce((s, [, c]) => s + c, 0) || 1;
  const top3 = sorted.slice(0, 3).reduce((s, [, c]) => s + c, 0);
  const topicRows = rows.filter(
    (r) => r.category === 'tema' || (categories?.get(r.id) ?? '').includes('tema') || r.id.includes('tema'),
  );
  const topicGroups = new Map<string, Set<string>>();
  for (const row of topicRows.length > 0 ? topicRows : rows) {
    const cat = row.category ?? categories?.get(row.id) ?? 'topic';
    const set = topicGroups.get(cat) ?? new Set<string>();
    for (const k of row.retrievalSourceKeys) set.add(k);
    topicGroups.set(cat, set);
  }
  const uniqSizes = [...topicGroups.values()].map((s) => s.size);
  const meanUniq =
    uniqSizes.length === 0 ? 0 : uniqSizes.reduce((a, b) => a + b, 0) / uniqSizes.length;
  return {
    top3DocumentShare: top3 / totalCitations,
    uniqueSourceKeysPerTopicMean: meanUniq,
    mostCitedSourceKeys: sorted.slice(0, 10).map(([key, count]) => ({ key, count })),
  };
}

export function quantizeScore025(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * 4) / 4;
}

export const GOLD_FACTS_HIT_TARGET = 0.6;
export const REFUSAL_RATE_TARGET = 0.1;
