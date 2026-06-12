export type SummaryField = 'hva' | 'hvem' | 'kostnad';

export type SummaryCards = Record<SummaryField, string>;

export const SUMMARY_FIELDS: SummaryField[] = ['hva', 'hvem', 'kostnad'];

export type TopicCard = {
  title: string;
  body: string;
};

export type AiSummaryV2 = {
  version: 2;
  narrative: string;
  who_affected: string;
  how_affected: string;
  topic_cards: TopicCard[];
  labels: string[];
  /** Legacy fields kept for compatibility */
  hva?: string;
  hvem?: string;
  kostnad?: string;
};

export type AiSummaryLegacy = {
  version: 1;
  hva: string;
  hvem: string;
  kostnad: string;
};

export type AiSummary = AiSummaryV2 | AiSummaryLegacy;

export function isAiSummaryV2(summary: AiSummary): summary is AiSummaryV2 {
  return summary.version === 2;
}
