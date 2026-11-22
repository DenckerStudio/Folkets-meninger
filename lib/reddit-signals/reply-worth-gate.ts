/** Deterministic pre-filter before Ollama reply_worth scoring. */

export const REPLY_WORTH_GATE = {
  maxAgeHours: 72,
  minComments: 3,
  maxComments: 150,
  minScore: 5,
} as const;

/** Admin UI / draft enqueue threshold (fase 2). */
export const REPLY_WORTH_SUGGEST_THRESHOLD = 4;

/**
 * Cheap title blocklist (meme / shopping / tip / giveaway).
 * Keep in sync with n8n Code in workflows/n8n/reddit-reply-worth.shared.ts.
 */
export const REPLY_WORTH_TITLE_BLOCKLIST =
  /\b(meme|memes|shitpost|shopping|gavekort|giveaway|tipp?\s*meg|hvilken\s+bank|beste\s+bank|lønnsslipp)\b/i;

export type ReplyWorthGateInput = {
  status: string;
  postedAt: string;
  score: number;
  numComments: number;
  removalType: string | null;
  title: string;
};

export type ReplyWorthGateResult = {
  pass: boolean;
  reasons: string[];
};

export function passesReplyWorthGate(
  row: ReplyWorthGateInput,
  nowMs = Date.now(),
): ReplyWorthGateResult {
  const reasons: string[] = [];

  if (row.status !== 'ny') {
    reasons.push('status er ikke ny');
  }

  if (row.removalType) {
    reasons.push('tråd er merket fjernet');
  }

  const postedMs = Date.parse(row.postedAt);
  if (!Number.isFinite(postedMs)) {
    reasons.push('ugyldig posted_at');
  } else {
    const ageHours = (nowMs - postedMs) / (60 * 60 * 1000);
    if (ageHours > REPLY_WORTH_GATE.maxAgeHours) {
      reasons.push(`eldre enn ${REPLY_WORTH_GATE.maxAgeHours} t`);
    }
    if (ageHours < 0) {
      reasons.push('posted_at i fremtiden');
    }
  }

  if (row.score < REPLY_WORTH_GATE.minScore) {
    reasons.push(`score under ${REPLY_WORTH_GATE.minScore}`);
  }

  if (row.numComments < REPLY_WORTH_GATE.minComments) {
    reasons.push(`færre enn ${REPLY_WORTH_GATE.minComments} kommentarer`);
  }

  if (row.numComments > REPLY_WORTH_GATE.maxComments) {
    reasons.push(`flere enn ${REPLY_WORTH_GATE.maxComments} kommentarer`);
  }

  if (REPLY_WORTH_TITLE_BLOCKLIST.test(row.title)) {
    reasons.push('tittel treffer blocklist');
  }

  return { pass: reasons.length === 0, reasons };
}

export function isReplyWorthSuggested(worth: number | null | undefined): boolean {
  return typeof worth === 'number' && worth >= REPLY_WORTH_SUGGEST_THRESHOLD;
}
