import { SUGGESTION_BODY_MAX, SUGGESTION_BODY_MIN } from '@/lib/suggestions/constants';

export function normalizeSuggestionBody(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

export function validateSuggestionBody(body: string): string | null {
  if (body.length < SUGGESTION_BODY_MIN) {
    return `Forslaget må være minst ${SUGGESTION_BODY_MIN} tegn.`;
  }
  if (body.length > SUGGESTION_BODY_MAX) {
    return `Forslaget kan være maks ${SUGGESTION_BODY_MAX} tegn.`;
  }
  return null;
}
