import assert from 'node:assert/strict';
import {
  GROUNDED_ANSWER_RULES_VERSION,
  buildEvalRagAnswerPrompt,
  groundedAnswerBehaviorLines,
  polishGroundedAnswer,
} from './grounded-answer';

assert.equal(GROUNDED_ANSWER_RULES_VERSION, 'grounded-answer-v3');
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
assert.match(prompt, /Hvert tall, årstall og sitat/);
assert.match(prompt, /Ikke start med "Basert på utdrag"/);
assert.match(prompt, /maks tre «Kilde N»/);

const noisy =
  'CO2-kutt i olje (Kilde 1). Kildene viser også flere voteringer knyttet til ulike forslag (Kilde 2, 3, 4, 5, 6, 7, 8, 10, 11, 12).';
const polished = polishGroundedAnswer(noisy);
assert.ok(!polished.includes('11'));
assert.ok(!/flere voteringer/i.test(polished));
assert.match(polished, /Kilde 1/);

console.log('lib/chat/grounded-answer.test.ts ok');
