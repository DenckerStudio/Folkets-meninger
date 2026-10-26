/**
 * Deterministic answer / retrieval metrics for RAG eval (no LLM).
 */

import { isRefusalAnswer } from '@/lib/chat/grounded-answer';

export { isRefusalAnswer };

export type AnswerMetricsRow = {
  id: string;
  category?: string;
  query: string;
  answer: string;
  excerpts: string[];
  goldFacts: string[];
};

export type CitationAuditResult = {
  /** Numbers/years in the answer that do not appear in any excerpt (after normalization). */
  unsupportedNumbers: string[];
  /** Quoted spans in the answer that do not appear in excerpts. */
  unsupportedQuotes: string[];
  citationSupportPass: boolean;
};

export type PerRowDeterministicMetrics = {
  id: string;
  category?: string;
  goldFacts: string[];
  goldFactHits: boolean[];
  goldFactsHitRate: number;
  goldFactsHit: boolean;
  goldFactsInExcerpts: boolean;
  isRefusal: boolean;
  /** Refusal while retrieved excerpts contain all gold facts (answer model fault). */
  incorrectRefusal: boolean;
  /** Refusal when excerpts lack gold facts (retrieval / chunking). */
  retrievalMissRefusal: boolean;
  correctRefusal: boolean;
  retrievalSourceKeys: string[];
  answerSourceKeys: string[];
  citationAudit: CitationAuditResult;
};

const NUMBER_TOKEN =
  /\b(?:\d{1,3}(?:[ \u00a0]?\d{3})*(?:[,.]\d+)?|\d+(?:[,.]\d+)?)\s*(?:kr|kroner|millioner|milliarder|%|prosent)?\b/gi;
const YEAR_TOKEN = /\b(?:19|20)\d{2}\b/g;
const QUOTE_PATTERNS = [
  /«([^»]{6,200})»/g,
  /\u201c([^\u201d]{6,200})\u201d/g,
  /"([^"]{6,200})"/g,
];

function excerptHaystack(excerpts: string[]): string {
  return normalizeMetricText(excerpts.join('\n'));
}

const CITE_INDEX = String.raw`\d{1,2}(?!\d)`;

/** Bracket citations [n] and short «Kilde N» lists are not factual numeric claims. */
export function stripCitationReferenceNumbersForAudit(answer: string): string {
  let s = answer;
  s = s.replace(
    new RegExp(String.raw`\(\s*Kilde\s+(?:${CITE_INDEX}\s*,\s*)*${CITE_INDEX}\s*\)`, 'gi'),
    '(Kilde)',
  );
  s = s.replace(
    new RegExp(String.raw`Kilde\s+${CITE_INDEX}(?:\s*,\s*(?:Kilde\s+)?${CITE_INDEX})*`, 'gi'),
    'Kilde',
  );
  s = s.replace(new RegExp(String.raw`\[(?:${CITE_INDEX})\](?:\[(?:${CITE_INDEX})\])*`, 'g'), '[]');
  return s;
}

function numberAppearsInHaystack(token: string, hay: string): boolean {
  const n = normalizeMetricText(token).replace(/\s/g, '');
  const compactHay = hay.replace(/\s/g, '');
  if (n.length < 2) return true;
  const digitsOnly = n.replace(/[^\d]/g, '');
  if (digitsOnly.length >= 2) {
    const escaped = digitsOnly.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bounded = new RegExp(`(^|[^0-9])${escaped}([^0-9]|$)`);
    return bounded.test(compactHay);
  }
  if (compactHay.includes(n)) return true;
  return false;
}

/** Deterministic faithfulness guard: uncited numbers and quotes must appear in excerpts. */
export function auditAnswerCitationSupport(answer: string, excerpts: string[]): CitationAuditResult {
  const hay = excerptHaystack(excerpts);
  const unsupportedNumbers: string[] = [];
  const unsupportedQuotes: string[] = [];
  const answerForNumbers = stripCitationReferenceNumbersForAudit(answer);

  const numberMatches = new Set<string>();
  let m: RegExpExecArray | null;
  const numRe = new RegExp(NUMBER_TOKEN.source, 'gi');
  while ((m = numRe.exec(answerForNumbers)) !== null) {
    const tok = m[0].trim();
    if (tok.length < 2) continue;
    numberMatches.add(tok);
  }
  const yearRe = new RegExp(YEAR_TOKEN.source, 'g');
  while ((m = yearRe.exec(answerForNumbers)) !== null) {
    numberMatches.add(m[0]);
  }

  for (const tok of numberMatches) {
    if (!numberAppearsInHaystack(tok, hay)) unsupportedNumbers.push(tok);
  }

  for (const pattern of QUOTE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(answer)) !== null) {
      const quote = m[1].trim();
      if (!quote) continue;
      const qn = normalizeMetricText(quote);
      if (qn.length < 8) continue;
      if (!hay.includes(qn) && !fuzzyFactInText(hay, quote)) {
        unsupportedQuotes.push(quote.slice(0, 120));
      }
    }
  }

  return {
    unsupportedNumbers,
    unsupportedQuotes,
    citationSupportPass: unsupportedNumbers.length === 0 && unsupportedQuotes.length === 0,
  };
}

export function citationRuleFaithfulnessCap(audit: CitationAuditResult): number {
  if (audit.citationSupportPass) return 1;
  const violations = audit.unsupportedNumbers.length + audit.unsupportedQuotes.length;
  if (violations >= 3) return 0.25;
  if (violations >= 1) return 0.5;
  return 1;
}

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

export function goldFactsPresentInExcerpts(excerpts: string[], goldFacts: string[]): boolean {
  if (goldFacts.length === 0) return true;
  const combined = excerpts.join('\n');
  return goldFacts.every((f) => fuzzyFactInText(combined, f));
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
  const goldInExcerpts = goldFactsPresentInExcerpts(row.excerpts, row.goldFacts);
  const citationAudit = auditAnswerCitationSupport(row.answer, row.excerpts);
  return {
    id: row.id,
    category: row.category,
    goldFacts: row.goldFacts,
    goldFactHits: perFact,
    goldFactsHitRate: hitRate,
    goldFactsHit: hit,
    goldFactsInExcerpts: goldInExcerpts,
    isRefusal: refusal,
    incorrectRefusal: refusal && hasGold && goldInExcerpts,
    retrievalMissRefusal: refusal && hasGold && !goldInExcerpts,
    correctRefusal: refusal && !hasGold,
    retrievalSourceKeys: extractSourceKeys(row.excerpts.join('\n')),
    answerSourceKeys: extractSourceKeys(row.answer),
    citationAudit,
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
  retrievalMissRefusalRate: number;
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
    retrievalMissRefusalRate:
      withGold.length === 0 ? 0 : withGold.filter((r) => r.retrievalMissRefusal).length / withGold.length,
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
