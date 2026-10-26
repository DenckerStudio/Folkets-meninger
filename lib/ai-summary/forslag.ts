import type { TopicCard } from '@/lib/ai-summary/types';

const FORSLAGENE_CARD_TITLE_RE = /^Forslagene\s*\(/i;

export function isForslageneTopicCard(title: string): boolean {
  return FORSLAGENE_CARD_TITLE_RE.test(title.trim());
}

/** Parse «1) a; 2) b.» from legacy topic card body. */
export function parseForslagItemsFromCardBody(body: string): string[] {
  const trimmed = body.trim().replace(/[.!?]+$/, '');
  if (!trimmed) return [];

  return trimmed
    .split(/\s*;\s*/)
    .map((part) => part.replace(/^\d+\)\s*/, '').trim())
    .filter((part) => part.length > 0);
}

/** `null` = column missing (legacy row); `[]` = explicitly no proposals. */
export function parseForslagJsonb(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  return raw
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0);
}

export function resolveForslagForSummary(
  stored: string[] | null,
  topicCards: TopicCard[],
): { forslag: string[]; topic_cards: TopicCard[] } {
  const withoutForslagCard = topicCards.filter((card) => !isForslageneTopicCard(card.title));

  if (stored !== null) {
    return {
      forslag: stored,
      topic_cards: withoutForslagCard,
    };
  }

  const legacyCard = topicCards.find((card) => isForslageneTopicCard(card.title));
  if (!legacyCard) {
    return { forslag: [], topic_cards: topicCards };
  }

  return {
    forslag: parseForslagItemsFromCardBody(legacyCard.body),
    topic_cards: withoutForslagCard,
  };
}
