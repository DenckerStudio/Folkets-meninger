export const POLITICAL_CONSENT_TEXT_VERSION = '2026-10-17';

export type PoliticalConsentPurpose =
  | 'political_storage'
  | 'political_profiling'
  | 'political_byok_activity';

export type PoliticalConsentState = {
  storage: boolean;
  profiling: boolean;
  byokActivity: boolean;
  textVersion: string;
};

export const EMPTY_POLITICAL_CONSENT_STATE: PoliticalConsentState = {
  storage: false,
  profiling: false,
  byokActivity: false,
  textVersion: POLITICAL_CONSENT_TEXT_VERSION,
};

export function hasPoliticalStorageConsent(state: PoliticalConsentState): boolean {
  return state.storage;
}

export function hasPoliticalProfilingConsent(state: PoliticalConsentState): boolean {
  return state.profiling;
}

export function hasPoliticalByokActivityConsent(state: PoliticalConsentState): boolean {
  return state.byokActivity;
}
