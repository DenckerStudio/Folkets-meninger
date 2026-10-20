import assert from 'node:assert/strict';
import {
  GROUNDED_ANSWER_RULES_VERSION,
  buildEvalRagAnswerPrompt,
  groundedAnswerBehaviorLines,
} from './grounded-answer';

assert.equal(GROUNDED_ANSWER_RULES_VERSION, 'grounded-answer-v1');
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
assert.match(prompt, /Ikke start med "Basert på utdrag"/);

console.log('lib/chat/grounded-answer.test.ts ok');
