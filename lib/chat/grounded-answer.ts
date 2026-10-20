/**
 * Shared grounding rules for answers built from retrieved excerpts.
 * Used by Stemme+ chat system instructions and offline RAG eval answer export.
 */

export const GROUNDED_ANSWER_RULES_VERSION = 'grounded-answer-v1';

/** Faithfulness / refusal behavior (citation format is set separately). */
export function groundedAnswerBehaviorLines(): string[] {
  return [
    '- Gi et svar ut fra det som faktisk står i kildene, også når svaret bare delvis dekker spørsmålet.',
    '- Du kan kort forklare «hvorfor» eller sammenhenger når utdragene gir grunnlag — ikke finn på begrunnelser som ikke står i teksten.',
    '- Ikke kopier lange avsnitt ordrett fra kildene, og ikke lim sammen flere kildetekster.',
    '- Si bare at kildene ikke besvarer spørsmålet når ingen kilde har relevant innhold. Når utdragene inneholder relevant stoff (selv om svaret blir ufullstendig), skriv et kort svar — ikke avvis med «kildene inneholder ikke» / «Dette fant jeg ikke i kildene».',
  ];
}

/**
 * Single-shot prompt for eval answer export (same grounding behavior as prod chat).
 */
export function buildEvalRagAnswerPrompt(query: string, excerpts: string[]): string {
  const context = excerpts
    .map((text, i) => `--- Kilde ${i + 1} ---\n${text}`)
    .join('\n\n');
  const rules = [
    '- Bruk bare fakta som står i kildene. Hver faktapåstand må kunne spores til en kilde.',
    '- Nevn kort hvilken sak/kilde du bygger på (bruk «Kilde N» eller dokumenthenvisning fra utdraget).',
    ...groundedAnswerBehaviorLines(),
  ].join('\n');

  return `Du er en saklig assistent for Folkets Meninger om Stortinget.

Spørsmål fra brukeren:
${query}

Kilder (kun disse — ikke bruk annen kunnskap):
${context || '(ingen kilder)'}

Skriv et kort svar på norsk bokmål (2–5 setninger) som besvarer spørsmålet.
${rules}
- Ikke start med "Basert på utdrag".

Svar:`;
}
