import type { EarnedBadge, KnowledgeActivityCounts, KnowledgeBadge, KnowledgeBadgeId } from './types';

export const KNOWLEDGE_BADGE_BY_ID: Record<KnowledgeBadgeId, KnowledgeBadge> = {
  informert_borger: {
    id: 'informert_borger',
    name: 'Informert borger',
    description: 'Du har vist at du kjenner innholdet i en sak.',
    howToEarn: 'Bestå kunnskapstesten på minst én sak.',
  },
  saksforsker: {
    id: 'saksforsker',
    name: 'Saksforsker',
    description: 'Du leser kildene, ikke bare overskriftene.',
    howToEarn: 'Les minst tre saksdokumenter i dokumentviseren.',
  },
  fylkesekspert: {
    id: 'fylkesekspert',
    name: 'Fylkesekspert',
    description: 'Du følger saker med utgangspunkt i fylket ditt.',
    howToEarn: 'Oppgi fylke og bestå en kunnskapstest.',
  },
};

export const KNOWLEDGE_BADGES: readonly KnowledgeBadge[] = [
  KNOWLEDGE_BADGE_BY_ID.informert_borger,
  KNOWLEDGE_BADGE_BY_ID.saksforsker,
  KNOWLEDGE_BADGE_BY_ID.fylkesekspert,
];

export const BADGE_THRESHOLDS = {
  informertBorgerQuizPasses: 1,
  saksforskerDocumentReads: 3,
  fylkesekspertQuizPasses: 1,
} as const;

export function badgeCatalog(): KnowledgeBadge[] {
  return [...KNOWLEDGE_BADGES];
}

export function getBadge(id: KnowledgeBadgeId): KnowledgeBadge {
  return KNOWLEDGE_BADGE_BY_ID[id];
}

export function earnedBadgeIds(counts: KnowledgeActivityCounts): KnowledgeBadgeId[] {
  const earned: KnowledgeBadgeId[] = [];
  if (counts.quizPasses >= BADGE_THRESHOLDS.informertBorgerQuizPasses) {
    earned.push('informert_borger');
  }
  if (counts.documentReads >= BADGE_THRESHOLDS.saksforskerDocumentReads) {
    earned.push('saksforsker');
  }
  if (counts.hasFylke && counts.quizPasses >= BADGE_THRESHOLDS.fylkesekspertQuizPasses) {
    earned.push('fylkesekspert');
  }
  return earned;
}

export function mergeBadgeState(
  catalog: readonly KnowledgeBadge[],
  earned: EarnedBadge[],
): Array<KnowledgeBadge & { earnedAt: string | null }> {
  const byId = new Map(earned.map((row) => [row.id, row.earnedAt]));
  return catalog.map((badge) => ({
    ...badge,
    earnedAt: byId.get(badge.id) ?? null,
  }));
}
