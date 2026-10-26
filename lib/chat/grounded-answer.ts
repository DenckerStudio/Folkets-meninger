/**
 * Shared grounding rules for answers built from retrieved excerpts.
 * Used by Stemme+ chat system instructions and offline RAG eval answer export.
 */

export const GROUNDED_ANSWER_RULES_VERSION = 'grounded-answer-v4';

/** Faithfulness / refusal behavior (citation format is set separately). */
export function groundedAnswerBehaviorLines(): string[] {
  return [
    '- Gi et svar ut fra det som faktisk står i kildene, også når svaret bare delvis dekker spørsmålet.',
    '- Du kan kort forklare «hvorfor» eller sammenhenger når utdragene gir grunnlag — ikke finn på begrunnelser som ikke står i teksten.',
    '- Ikke kopier lange avsnitt ordrett fra kildene, og ikke lim sammen flere kildetekster.',
    '- Bruk ikke tall, årstall, prosenter eller beløp med mindre det samme tallet/året står i minst én kilde. Sett kildenummer i hakeparentes rett etter påstanden, for eksempel [1].',
    '- Ikke bruk sitattegn eller ordrette sitater med mindre ordlyden finnes i en kilde.',
    '- Si bare at kildene ikke besvarer spørsmålet når utdragene er tomme eller åpenbart irrelevante. Når utdragene inneholder relevant stoff (selv om svaret blir ufullstendig), skriv et kort svar — ikke avvis med «kildene inneholder ikke» / «Dette fant jeg ikke i kildene».',
    '- Hvis utdragene bare er metadata/titler uten substans om spørsmålet, si kort at kildene ikke gir nok grunnlag — ikke spekuler.',
    '- Prioriter dokument- og innstillingsutdrag fremfor lange voteringsoversikter, med mindre spørsmålet handler om stemmegang.',
    '- Oppsummer hva partiene stemte når voteringer i utdragene svarer på spørsmålet — ikke skriv at kildene «ikke gir detaljer» når stemmer står i teksten.',
    '- Bruk maks tre kildenumre i hakeparentes totalt (for eksempel [1] eller [2][3]). Ikke list opp mange numre på rad.',
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
    '- Bruk bare fakta som står i kildene. Hver faktapåstand må kunne spores til en kilde (sett [n] rett etter påstanden; kilde 1 i utdraget = [1]).',
    '- Hvert tall, årstall og sitat må finnes ordrett i minst én av kildene over.',
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
