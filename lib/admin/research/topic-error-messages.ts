/** Codes n8n may send in `p_error` (stored as-is). Anything else becomes `ukjent_feil`. */
export const RESEARCH_TOPIC_BRIEF_N8N_ERROR_CODES = [
  'modell_feil',
  'ugyldig_svar',
  'henting_feil',
  'tema_mangler',
] as const;

export type ResearchTopicBriefN8nErrorCode =
  (typeof RESEARCH_TOPIC_BRIEF_N8N_ERROR_CODES)[number];

/** Stored on `research_topics.error` (including normalized and internal codes). */
export const RESEARCH_TOPIC_BRIEF_STORED_ERROR_CODES = [
  ...RESEARCH_TOPIC_BRIEF_N8N_ERROR_CODES,
  'ukjent_feil',
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  modell_feil: 'Språkmodellen svarte ikke',
  ugyldig_svar: 'Svaret kunne ikke leses',
  henting_feil: 'Kildesøket feilet',
  tema_mangler: 'Temaet mangler eller er ufullstendig',
  ukjent_feil: 'Noe gikk galt',
};

export const RESEARCH_TOPIC_BRIEF_DEVELOPER_HINT =
  'Si fra til en utvikler hvis feilen kommer igjen.';

export function researchTopicBriefErrorShowsDeveloperHint(
  code: string | null | undefined,
): boolean {
  const normalized = code?.trim();
  if (!normalized || normalized === 'ukjent_feil') return true;
  return !(normalized in ERROR_MESSAGES);
}

export function formatResearchTopicBriefError(code: string | null | undefined): string {
  if (!code?.trim()) return ERROR_MESSAGES.ukjent_feil;
  const normalized = code.trim();
  return ERROR_MESSAGES[normalized] ?? ERROR_MESSAGES.ukjent_feil;
}

/** Whether the row/detail UI should offer «Prøv igjen» for this failure code. */
export function researchTopicBriefErrorAllowsRetry(code: string | null | undefined): boolean {
  return code?.trim() !== 'tema_mangler';
}

export function researchTopicBriefFailedMessage(code: string | null | undefined): string {
  const text = formatResearchTopicBriefError(code);
  if (!researchTopicBriefErrorAllowsRetry(code)) {
    return text;
  }
  return `${text}. Prøv igjen.`;
}
