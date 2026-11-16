import assert from 'node:assert/strict';
import { parseSakPageTabParam, sakPageTabHref, sakPageTabFromLocationHash } from './sak-page-tabs';

assert.equal(parseSakPageTabParam(undefined), 'oversikt');
assert.equal(parseSakPageTabParam('dokumenter'), 'dokumenter');
assert.equal(parseSakPageTabParam('ugyldig'), 'oversikt');
assert.equal(parseSakPageTabParam('argumenter'), 'argumenter');
assert.equal(parseSakPageTabParam('argumenter', new Set(['argumenter'])), 'oversikt');
assert.equal(parseSakPageTabParam(['konsekvens']), 'konsekvens');

assert.equal(sakPageTabFromLocationHash('#dokumenter'), 'dokumenter');
assert.equal(sakPageTabFromLocationHash('#for-deg'), 'konsekvens');

assert.equal(sakPageTabHref('/dashboard/sak/1', 'dokumenter'), '/dashboard/sak/1?fane=dokumenter');
assert.equal(
  sakPageTabHref('/dashboard/sak/1', 'oversikt', { dokument: 'x' }),
  '/dashboard/sak/1?dokument=x',
);

console.log('sak-page-tabs.test.ts OK');