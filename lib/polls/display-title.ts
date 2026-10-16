const QUESTION_PHRASE =
  /^(mener du|burde|bør|skal|skal vi|er det|synes du|hva mener|støtter du|er du)\b/i;

/** Adds «?» to poll titles phrased as questions (e.g. «Mener du …») at render time. */
export function formatPollDisplayTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed || trimmed.endsWith('?')) {
    return trimmed;
  }
  if (QUESTION_PHRASE.test(trimmed)) {
    return `${trimmed}?`;
  }
  return trimmed;
}
