export const AI_FEEDBACK_REASON_CODES = [
  { value: 'sprak', label: 'Språk (dansk/nynorsk/stavefeil)' },
  { value: 'faktafeil', label: 'Faktafeil' },
  { value: 'ikke_noytral', label: 'Ikke nøytral' },
  { value: 'duplikat', label: 'Duplikat' },
  { value: 'irrelevant', label: 'Irrelevant' },
  { value: 'darlig_formulering', label: 'Dårlig formulering' },
  { value: 'for_lang', label: 'For lang' },
  { value: 'feil_sak', label: 'Feil sak' },
  { value: 'sensitivt', label: 'Sensitivt tema' },
  { value: 'ikke_aksjon', label: 'Ikke en aksjon' },
  { value: 'annet', label: 'Annet' },
] as const;

export type AiFeedbackReasonCode = (typeof AI_FEEDBACK_REASON_CODES)[number]['value'];

export function isAiFeedbackReasonCode(value: string): value is AiFeedbackReasonCode {
  return AI_FEEDBACK_REASON_CODES.some((item) => item.value === value);
}

export const AI_REASON_NOTE_MAX = 300;
