import assert from 'node:assert/strict';
import {
  isRedditSignalApiAction,
  validateRedditSignalActionInput,
} from '@/lib/reddit-signals/actions';

assert.equal(isRedditSignalApiAction('ignorer'), true);
assert.equal(isRedditSignalApiAction('nope'), false);

assert.equal(
  validateRedditSignalActionInput('ignorer', { reason: 'ab' }),
  'Oppgi en kort begrunnelse (minst 3 tegn) for å ignorere.',
);
assert.equal(validateRedditSignalActionInput('ignorer', { reason: '  Ikke aktuelt  ' }), null);
assert.equal(validateRedditSignalActionInput('marker_brukt', {}), null);
assert.equal(
  validateRedditSignalActionInput('blokker', { reason: 'spam' }),
  null,
);

console.log('lib/reddit-signals/actions.test.ts: ok');