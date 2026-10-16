import assert from 'node:assert/strict';
import { formatPollDisplayTitle } from './display-title';

assert.equal(formatPollDisplayTitle('Mener du Norge bør gå ut av NATO'), 'Mener du Norge bør gå ut av NATO?');
assert.equal(formatPollDisplayTitle('Allerede spørsmål?'), 'Allerede spørsmål?');
assert.equal(formatPollDisplayTitle('Budsjett 2026'), 'Budsjett 2026');

console.log('display-title.test.ts: ok');
