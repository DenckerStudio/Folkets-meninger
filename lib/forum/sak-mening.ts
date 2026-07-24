/** Prefix required on user-created ja/nei polls linked to a Stortinget sak. */
export const SAK_MENING_PREFIX = '(Jeg mener) ';

export const SAK_MENING_TOPIC_TAG = 'sak_mening';

export const SAK_MENING_STATEMENT_MIN = 8;
export const SAK_MENING_STATEMENT_MAX = 240;

export function formatSakMeningQuestion(statement: string): string {
  const trimmed = statement.trim();
  if (trimmed.toLowerCase().startsWith(SAK_MENING_PREFIX.toLowerCase())) {
    return trimmed;
  }
  return `${SAK_MENING_PREFIX}${trimmed}`;
}

export function validateSakMeningStatement(statement: string): { ok: true; question: string } | { ok: false; error: string } {
  const trimmed = statement.trim();
  if (trimmed.length < SAK_MENING_STATEMENT_MIN) {
    return {
      ok: false,
      error: `Skriv minst ${SAK_MENING_STATEMENT_MIN} tegn etter «${SAK_MENING_PREFIX.trim()}».`,
    };
  }

  const question = formatSakMeningQuestion(trimmed);
  if (question.length > 280) {
    return { ok: false, error: 'Spørsmålet kan være maks 280 tegn.' };
  }

  if (!question.startsWith(SAK_MENING_PREFIX)) {
    return {
      ok: false,
      error: `Alle ja/nei-meninger må starte med «${SAK_MENING_PREFIX.trim()}».`,
    };
  }

  return { ok: true, question };
}

export function isSakMeningPrompt(topicTags: string[] | null | undefined): boolean {
  return (topicTags ?? []).includes(SAK_MENING_TOPIC_TAG);
}
