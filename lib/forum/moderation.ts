export type ModerationCategory = 'hate' | 'sexual' | 'spam' | 'other';

export type ModerationResult =
  | { ok: true }
  | { ok: false; reason: string; category: ModerationCategory };

const HATE_PATTERNS = [
  /\bnazi\b/i,
  /\bhitler\b/i,
  /\bjævla\s+(neger|jævel)/i,
  /\b(kuk|fitte)\s+(suger|liker)/i,
  /\bdrep\s+(alle|dem|innvandrere)/i,
  /\b(white\s+power|heil\s+hitler)/i,
  /\b(jødesvin|jøde\s*hat)/i,
] as const;

const SEXUAL_PATTERNS = [
  /\bporn(o|hub)?\b/i,
  /\bxnxx\b/i,
  /\bxvideos\b/i,
  /\bsex\s*video/i,
  /\berotisk\s+film/i,
  /\bonlyfans\b/i,
] as const;

const SPAM_PATTERNS = [
  /(\b\w+\b)(\s+\1){4,}/i,
  /(https?:\/\/[^\s]+){6,}/i,
  /\b(kjøp\s+nå|gratis\s+penger|crypto\s+giveaway)\b/i,
] as const;

export function moderateForumText(text: string): ModerationResult {
  const normalized = text.trim();
  if (!normalized) {
    return { ok: false, reason: 'Innholdet kan ikke være tomt', category: 'other' };
  }

  for (const pattern of HATE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        ok: false,
        reason: 'Innlegget bryter retningslinjene for respektfull debatt',
        category: 'hate',
      };
    }
  }

  for (const pattern of SEXUAL_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        ok: false,
        reason: 'Eksplisitt eller upassende innhold er ikke tillatt',
        category: 'sexual',
      };
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        ok: false,
        reason: 'Innlegget ser ut som spam',
        category: 'spam',
      };
    }
  }

  const capsRatio =
    (normalized.match(/[A-ZÆØÅ]/g)?.length ?? 0) / Math.max(normalized.length, 1);
  if (normalized.length > 40 && capsRatio > 0.7) {
    return {
      ok: false,
      reason: 'Unngå å skrive hele innlegget med store bokstaver',
      category: 'spam',
    };
  }

  return { ok: true };
}

export function moderateForumPost(title: string, body: string): ModerationResult {
  const titleCheck = moderateForumText(title);
  if (!titleCheck.ok) return titleCheck;

  const bodyCheck = moderateForumText(body);
  if (!bodyCheck.ok) return bodyCheck;

  return { ok: true };
}
