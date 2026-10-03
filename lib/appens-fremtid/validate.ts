import {
  CHANGELOG_BODY_MAX,
  CHANGELOG_BODY_MIN,
  CHANGELOG_TITLE_MAX,
  CHANGELOG_TITLE_MIN,
  ROADMAP_BODY_MAX,
  ROADMAP_BODY_MIN,
  ROADMAP_TITLE_MAX,
  ROADMAP_TITLE_MIN,
  SUGGESTION_BODY_MAX,
  SUGGESTION_BODY_MIN,
  SUGGESTION_TITLE_MAX,
  SUGGESTION_TITLE_MIN,
  isRoadmapStatus,
  isSuggestionAudience,
  isSuggestionCategory,
  type RoadmapStatus,
  type SuggestionAudience,
  type SuggestionCategory,
} from '@/lib/appens-fremtid/constants';

export function normalizeText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

function lengthError(label: string, value: string, min: number, max: number): string | null {
  if (value.length < min) return `${label} må være minst ${min} tegn.`;
  if (value.length > max) return `${label} kan være maks ${max} tegn.`;
  return null;
}

export function validateSuggestionTitle(title: string): string | null {
  return lengthError('Tittelen', title, SUGGESTION_TITLE_MIN, SUGGESTION_TITLE_MAX);
}

export function validateSuggestionBody(body: string): string | null {
  return lengthError('Beskrivelsen', body, SUGGESTION_BODY_MIN, SUGGESTION_BODY_MAX);
}

export function validateSuggestionInput(input: {
  title: unknown;
  body: unknown;
  category: unknown;
  audience: unknown;
}): { title: string; body: string; category: SuggestionCategory; audience: SuggestionAudience } | { error: string } {
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);
  const titleError = validateSuggestionTitle(title);
  if (titleError) return { error: titleError };
  const bodyError = validateSuggestionBody(body);
  if (bodyError) return { error: bodyError };
  if (!isSuggestionCategory(input.category)) return { error: 'Velg en kategori.' };
  if (!isSuggestionAudience(input.audience)) return { error: 'Velg hvem forslaget gjelder.' };
  return { title, body, category: input.category, audience: input.audience };
}

export function validateChangelogInput(input: {
  title: unknown;
  body: unknown;
}): { title: string; body: string } | { error: string } {
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);
  const titleError = lengthError('Tittelen', title, CHANGELOG_TITLE_MIN, CHANGELOG_TITLE_MAX);
  if (titleError) return { error: titleError };
  const bodyError = lengthError('Teksten', body, CHANGELOG_BODY_MIN, CHANGELOG_BODY_MAX);
  if (bodyError) return { error: bodyError };
  return { title, body };
}

export function validateRoadmapInput(input: {
  title: unknown;
  body: unknown;
  status: unknown;
}): { title: string; body: string; status: RoadmapStatus } | { error: string } {
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);
  const titleError = lengthError('Tittelen', title, ROADMAP_TITLE_MIN, ROADMAP_TITLE_MAX);
  if (titleError) return { error: titleError };
  const bodyError = lengthError('Teksten', body, ROADMAP_BODY_MIN, ROADMAP_BODY_MAX);
  if (bodyError) return { error: bodyError };
  if (!isRoadmapStatus(input.status)) return { error: 'Velg en status.' };
  return { title, body, status: input.status };
}
