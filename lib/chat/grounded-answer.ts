/**
 * Shared grounding rules for answers built from retrieved excerpts.
 * Used by Stemme+ chat system instructions and offline RAG eval answer export.
 */

import { reconcilePartyVoteClaimsWithSources } from '@/lib/chat/party-vote-answer-guard';

export const GROUNDED_ANSWER_RULES_VERSION = 'grounded-answer-v4.1';

const REFUSAL_PATTERNS = [
  /\bkildene\s+inneholder\s+ikke\b/i,
  /\bkan\s+ikke\s+besvare\b/i,
  /\bfinnes\s+ikke\s+(?:nok\s+)?informasjon\b/i,
  /\bikke\s+nok\s+.*\bkildene\b/i,
  /\bspørsmålet\s+kan\s+ikke\s+besvares\b/i,
  /\bmangler\s+informasjon\s+i\s+kildene\b/i,
  /\bkildene\s+gir\s+ikke\s+nok\s+grunnlag\b/i,
  /\bikke\s+nok\s+grunnlag\b/i,
  /\bdette\s+fant\s+jeg\s+ikke\s+i\s+kildene\b/i,
];

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
    '- Når du avviser eller skriver at kildene ikke gir grunnlag, ikke sett [n]-henvisninger i avslagssetningen.',
    '- Påstå aldri at samme parti stemte både for og mot i samme votering. Oppsummer stemmegang ut fra én stemmeretning per parti per votering i kildene.',
    '- Prioriter dokument- og innstillingsutdrag fremfor lange voteringsoversikter, med mindre spørsmålet handler om stemmegang.',
    '- Oppsummer hva partiene stemte når voteringer i utdragene svarer på spørsmålet — ikke skriv at kildene «ikke gir detaljer» når stemmer står i teksten.',
    '- Bruk maks tre kildenumre i hakeparentes totalt (for eksempel [1] eller [2][3]). Ikke list opp mange numre på rad.',
  ];
}

export function isRefusalAnswer(answer: string): boolean {
  const a = answer.trim();
  if (!a) return false;
  return REFUSAL_PATTERNS.some((re) => re.test(a));
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

const LONG_KILDE_LIST =
  /\(\s*Kilde\s+\d+(?:\s*,\s*(?:Kilde\s+)?\d+){3,}[^)]*\)/gi;
const INLINE_KILDE_RUN = /Kilde\s+\d+(?:\s*,\s*(?:Kilde\s+)?\d+){3,}/gi;
const LONG_BRACKET_CITE_RUN = /(?:\[\d{1,2}\]){4,}/g;
const VOTERING_ONLY_SENTENCE =
  /\bKildene\s+viser\s+også\s+flere\s+voteringer[^.]*\./gi;

/** Trim citation noise and hedging the model often adds after generation. */
export function polishGroundedAnswer(answer: string, _excerpts?: string[]): string {
  let text = answer.trim();
  if (!text) return text;

  text = text.replace(LONG_KILDE_LIST, '(flere kilder)');
  text = text.replace(INLINE_KILDE_RUN, 'flere kilder');
  text = text.replace(LONG_BRACKET_CITE_RUN, '[flere kilder]');
  text = text.replace(VOTERING_ONLY_SENTENCE, '').trim();

  return text.replace(/\s+([,.])/g, '$1').trim();
}

/** Remove [n] citation markers (refusal answers should not cite). */
export function stripBracketCitations(answer: string): string {
  return answer
    .replace(/\s*\[(?:\d{1,2})\](?:\[(?:\d{1,2})\])*/g, '')
    .replace(/\s+([,.])/g, '$1')
    .trim();
}

/** Shared post-generation cleanup for eval export and grounded chat answers. */
export function postProcessGroundedAnswer(answer: string, excerpts: string[]): string {
  let text = polishGroundedAnswer(answer, excerpts);
  if (isRefusalAnswer(text)) {
    text = stripBracketCitations(text);
  }
  text = reconcilePartyVoteClaimsWithSources(text, excerpts);
  return text.trim();
}
