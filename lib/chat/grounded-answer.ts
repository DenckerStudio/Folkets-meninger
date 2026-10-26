/**
 * Shared grounding rules for answers built from retrieved excerpts.
 * Used by Stemme+ chat system instructions and offline RAG eval answer export.
 */

export const GROUNDED_ANSWER_RULES_VERSION = 'grounded-answer-v3';

/** Faithfulness / refusal behavior (citation format is set separately). */
export function groundedAnswerBehaviorLines(): string[] {
  return [
    '- Gi et svar ut fra det som faktisk står i kildene, også når svaret bare delvis dekker spørsmålet.',
    '- Du kan kort forklare «hvorfor» eller sammenhenger når utdragene gir grunnlag — ikke finn på begrunnelser som ikke står i teksten.',
    '- Ikke kopier lange avsnitt ordrett fra kildene, og ikke lim sammen flere kildetekster.',
    '- Bruk ikke tall, årstall, prosenter eller beløp med mindre det samme tallet/året står i minst én kilde. Nevn da «Kilde N» (eller dokumenthenvisning fra utdraget).',
    '- Ikke bruk sitattegn eller ordrette sitater med mindre ordlyden finnes i en kilde.',
    '- Si bare at kildene ikke besvarer spørsmålet når utdragene er tomme eller åpenbart irrelevante. Når utdragene inneholder relevant stoff (selv om svaret blir ufullstendig), skriv et kort svar — ikke avvis med «kildene inneholder ikke» / «Dette fant jeg ikke i kildene».',
    '- Hvis utdragene bare er metadata/titler uten substans om spørsmålet, si kort at kildene ikke gir nok grunnlag — ikke spekuler.',
    '- Prioriter dokument- og innstillingsutdrag fremfor lange voteringsoversikter, med mindre spørsmålet handler om stemmegang.',
    '- Oppsummer hva partiene stemte når voteringer i utdragene svarer på spørsmålet — ikke skriv at kildene «ikke gir detaljer» når stemmer står i teksten.',
    '- Bruk maks tre «Kilde N»-henvisninger totalt. Ikke list opp mange kilde-numre på rad (for eksempel «Kilde 2, 3, 4 …»).',
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
    '- Bruk bare fakta som står i kildene. Hver faktapåstand må kunne spores til en kilde (angi «Kilde N»).',
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

const LONG_KILDE_LIST =
  /\(\s*Kilde\s+\d+(?:\s*,\s*(?:Kilde\s+)?\d+){3,}[^)]*\)/gi;
const INLINE_KILDE_RUN = /Kilde\s+\d+(?:\s*,\s*(?:Kilde\s+)?\d+){3,}/gi;
const VOTERING_ONLY_SENTENCE =
  /\bKildene\s+viser\s+også\s+flere\s+voteringer[^.]*\./gi;

/** Trim citation noise and hedging the model often adds after generation. */
export function polishGroundedAnswer(answer: string, _excerpts?: string[]): string {
  let text = answer.trim();
  if (!text) return text;

  text = text.replace(LONG_KILDE_LIST, '(flere kilder)');
  text = text.replace(INLINE_KILDE_RUN, 'flere kilder');
  text = text.replace(VOTERING_ONLY_SENTENCE, '').trim();

  return text.replace(/\s+([,.])/g, '$1').trim();
}
