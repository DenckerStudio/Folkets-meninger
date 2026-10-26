import assert from 'node:assert/strict';
import {
  GROUNDED_ANSWER_RULES_VERSION,
  buildEvalRagAnswerPrompt,
  groundedAnswerBehaviorLines,
  isRefusalAnswer,
  polishGroundedAnswer,
  postProcessGroundedAnswer,
  stripBracketCitations,
} from './grounded-answer';
import { formatVoteringRagSummary } from '@/lib/stortinget-votering-rag';

assert.equal(GROUNDED_ANSWER_RULES_VERSION, 'grounded-answer-v4.1');
assert.ok(groundedAnswerBehaviorLines().length >= 3);

const excerpts = [
  'Representantforslag om forurensningsfri fotballglede\n\nDokument 8:265 S',
  'Endringer i forurensningsloven (utvidet virkeområde)',
];
const prompt = buildEvalRagAnswerPrompt('hva gjør stortinget med forurensning', excerpts);
assert.match(prompt, /bare delvis dekker spørsmålet/);
assert.match(prompt, /«hvorfor»/);
assert.match(prompt, /Dette fant jeg ikke i kildene/);
assert.match(prompt, /Kilde 1/);
assert.match(prompt, /\[n\]/);
assert.match(prompt, /ikke sett \[n\]-henvisninger i avslagssetningen/);
assert.match(prompt, /samme parti stemte både for og mot/i);
assert.match(prompt, /Hvert tall, årstall og sitat/);
assert.match(prompt, /Ikke start med "Basert på utdrag"/);
assert.match(prompt, /maks tre kildenumre/);

const noisyBracket =
  'CO2-kutt i olje [1]. Kildene viser også flere voteringer knyttet til ulike forslag [2][3][4][5][6][7].';
const polished = polishGroundedAnswer(noisyBracket);
assert.ok(!/flere voteringer/i.test(polished));
assert.match(polished, /\[1\]/);

const refusal =
  'Kildene inneholder ikke informasjon om begrunnelsen for tiltaket [4].';
assert.equal(isRefusalAnswer(refusal), true);
assert.equal(stripBracketCitations(refusal), 'Kildene inneholder ikke informasjon om begrunnelsen for tiltaket.');

const refusalProcessed = postProcessGroundedAnswer(refusal, excerpts);
assert.ok(!refusalProcessed.includes('[4]'));

const voteringExcerpt = formatVoteringRagSummary('28432', 'Drivstoff', { SV: 'for' });
const partyFix = postProcessGroundedAnswer(
  'I votering 28432 stemte SV for. SV stemte mot i votering 28432.',
  [voteringExcerpt],
);
assert.match(partyFix, /stemte SV for/i);
assert.ok(!/stemte SV mot/i.test(partyFix));

console.log('lib/chat/grounded-answer.test.ts ok');
