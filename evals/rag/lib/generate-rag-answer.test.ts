import assert from 'node:assert/strict';
import {
  buildRagAnswerPrompt,
  isDisallowedExcerptPassthrough,
} from './generate-rag-answer';

const excerpts = [
  'Representantforslag om forurensningsfri fotballglede\n\nDokument 8:265 S',
  'Endringer i forurensningsloven (utvidet virkeområde)',
];

const legacyPassthrough = `Basert på utdrag: ${excerpts.join(' ').slice(0, 1200)}`;

assert.equal(isDisallowedExcerptPassthrough(legacyPassthrough, excerpts), true);
assert.equal(
  isDisallowedExcerptPassthrough(
    'Stortinget har behandlet flere saker om forurensning, blant annet fotballbaner og lovendringer i forurensningsloven (Prop. 82 L).',
    excerpts,
  ),
  false,
);

const prompt = buildRagAnswerPrompt('hva gjør stortinget med forurensning', excerpts);
assert.match(prompt, /Ikke kopier lange avsnitt ordrett/);
assert.match(prompt, /Ikke start med "Basert på utdrag"/);
assert.match(prompt, /hva gjør stortinget med forurensning/);

console.log('generate-rag-answer.test.ts: ok');
