export const RESEARCH_API_ERROR_CODES = {
  requestConflict: 'research_request_conflict',
  briefActive: 'research_brief_active',
} as const;

export type ResearchApiErrorCode =
  (typeof RESEARCH_API_ERROR_CODES)[keyof typeof RESEARCH_API_ERROR_CODES];

export function researchApiErrorMessage(code: ResearchApiErrorCode): string {
  switch (code) {
    case RESEARCH_API_ERROR_CODES.requestConflict:
      return 'request_id er allerede knyttet til en annen oppgave';
    case RESEARCH_API_ERROR_CODES.briefActive:
      return 'Denne handlingen kjører allerede.';
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}
