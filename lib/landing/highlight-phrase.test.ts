import assert from 'node:assert/strict';
import { splitHighlightPhrase } from '@/lib/landing/highlight-phrase';

const howItWorks = splitHighlightPhrase('Fra din mening til Stortinget', 'mening');
assert.deepEqual(howItWorks, {
  before: 'Fra din ',
  match: 'mening',
  after: ' til Stortinget',
});

const hero = splitHighlightPhrase('Din mening mellom valgene.', 'mening');
assert.deepEqual(hero, {
  before: 'Din ',
  match: 'mening',
  after: ' mellom valgene.',
});

const cta = splitHighlightPhrase('Vil du at meningen din skal synes?', 'meningen');
assert.deepEqual(cta, {
  before: 'Vil du at ',
  match: 'meningen',
  after: ' din skal synes?',
});

assert.equal(
  splitHighlightPhrase('Si meningen din om det Stortinget faktisk behandler.', 'mening'),
  null,
  '«mening» must not match inside «meningen»',
);

assert.equal(splitHighlightPhrase('Ingen nøkkel her', 'mening'), null);
assert.equal(splitHighlightPhrase('Fra din mening til Stortinget', ''), null);

console.log('landing/highlight-phrase.test.ts: ok');
