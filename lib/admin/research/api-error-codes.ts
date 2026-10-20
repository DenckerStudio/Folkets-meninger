export const RESEARCH_API_ERROR_CODES = {
  requestConflict: 'research_request_conflict',
  briefActive: 'research_brief_active',
} as const;

export type ResearchApiErrorCode =
  (typeof RESEARCH_API_ERROR_CODES)[keyof typeof RESEARCH_API_ERROR_CODES];

export function researchApiErrorMessage(code: ResearchApiErrorCode): string {
  switch (code) {
    case RESEARCH_API_ERROR_CODES.requestConflict:
      return 'Denne forespørselen gjelder en annen research-oppgave. Prøv igjen med en ny handling.';
    case RESEARCH_API_ERROR_CODES.briefActive:
      return 'Det kjører allerede en oppgave av denne typen for saken.';
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}
