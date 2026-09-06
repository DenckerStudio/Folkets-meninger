export type ModerationCategory = 'hate' | 'discrimination' | 'sexual' | 'violence' | 'spam' | 'other';

export type ContentModerationResult =
  | { approved: true }
  | { approved: false; category: ModerationCategory; reason: string };

const HATE_RE =
  /(nazi|heil hitler|white power|jødesvin|jødehat|jævla\s+(neger|jævel)|drep\s+(alle|dem|innvandrere))/i;

const DISCRIMINATION_RE =
  /((rase|religion|legning|funksjonshemmede)\s+(burde|skal)\s+(ut|fjernes|nektes)|(alle|ingen)\s+(muslimer|jøder|homofile|transpersoner|romfolk)\s+(er|bør|skal)|(send|kast)\s+(dem|alle)\s+ut)/i;

const SEXUAL_RE = /(porno|pornhub|xnxx|xvideos|onlyfans|sex\s*video|erotisk\s+film)/i;

const VIOLENCE_RE =
  /((drep|skyt|henrett)\s+(ham|henne|dem|alle)|bank\s+opp\s+(ham|henne|dem|alle)|(bombe|terror|massakre)\s+(stortinget|regjeringen|politikere|dem))/i;

const SPAM_RE = /(kjøp\s+nå|gratis\s+penger|crypto\s+giveaway)/i;

/** Lightweight regex moderation ported from legacy forum_moderation_check. */
export function checkDiscussionContent(text: string): ContentModerationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      approved: false,
      category: 'other',
      reason: 'Innholdet kan ikke være tomt',
    };
  }

  const normalized = trimmed.toLowerCase();

  if (HATE_RE.test(normalized)) {
    return {
      approved: false,
      category: 'hate',
      reason: 'Innlegget bryter retningslinjene for respektfull debatt',
    };
  }

  if (DISCRIMINATION_RE.test(normalized)) {
    return {
      approved: false,
      category: 'discrimination',
      reason: 'Diskriminerende generaliseringer er ikke tillatt',
    };
  }

  if (SEXUAL_RE.test(normalized)) {
    return {
      approved: false,
      category: 'sexual',
      reason: 'Eksplisitt eller upassende innhold er ikke tillatt',
    };
  }

  if (VIOLENCE_RE.test(normalized)) {
    return {
      approved: false,
      category: 'violence',
      reason: 'Oppfordringer til vold er ikke tillatt',
    };
  }

  if (SPAM_RE.test(normalized)) {
    return {
      approved: false,
      category: 'spam',
      reason: 'Innlegget ser ut som spam',
    };
  }

  return { approved: true };
}
