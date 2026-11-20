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

const MIN_CONTAINMENT_CHARS = 25;

function forslagKey(item: string): string {
  return item.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Renser lagrede forslag før visning. Uttrekket fra dokumentene kan gi (1) innledninger som
 * «… fremmes følgende forslag:», (2) samme forslag to ganger, gjerne med innledningen som prefiks,
 * og (3) setningsrester som starter med komma. Bare tekst som allerede finnes i raden brukes.
 */
export function cleanForslagForDisplay(items: readonly string[]): string[] {
  const normalized = items
    .map((item) => String(item ?? '').replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 0 && !item.endsWith(':'))
    .map((item) => {
      const stripped = item.replace(/^[\s,;:.]+/, '');
      return stripped.charAt(0).toLocaleUpperCase('nb-NO') + stripped.slice(1);
    })
    .filter((item) => item.length > 0);

  const keys = normalized.map(forslagKey);
  const kept: string[] = [];
  const seen = new Set<string>();

  normalized.forEach((item, index) => {
    const key = keys[index];
    if (seen.has(key)) return;
    const containedInLonger =
      key.length >= MIN_CONTAINMENT_CHARS &&
      keys.some((other, otherIndex) => otherIndex !== index && other.length > key.length && other.includes(key));
    if (containedInLonger) return;
    seen.add(key);
    kept.push(item);
  });

  return kept;
}
